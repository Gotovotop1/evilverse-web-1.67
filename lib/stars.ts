import { createHash, timingSafeEqual } from "node:crypto"
import { pool } from "@/lib/db"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { kvGet, kvSet } from "@/lib/kv"
import { sendDiscordWebhook } from "@/lib/server-utils"

/*
 * Оплата зірками Telegram (Telegram Stars, валюта XTR) через твого бота.
 *   TELEGRAM_BOT_TOKEN — токен бота від @BotFather
 * Сайт створює рахунок (invoice link) → гравець платить у Telegram → Telegram надсилає сайту
 * pre_checkout_query (ми перевіряємо замовлення) і successful_payment (позначаємо «оплачено»).
 * Вебхук /api/telegram ставиться автоматично під час першого замовлення.
 */

const API = process.env.TELEGRAM_API_BASE || "https://api.telegram.org"
const token = () => (process.env.TELEGRAM_BOT_TOKEN ?? "").trim()

export function starsConfigured() {
  return /^\d+:[\w-]{30,}$/.test(token())
}

/** Секрет для вебхука: Telegram повертає його в заголовку X-Telegram-Bot-Api-Secret-Token. */
export function webhookSecret() {
  return createHash("sha256").update(`evilverse-webhook:${token()}`).digest("hex").slice(0, 48)
}

export function webhookSecretMatches(header: string | null) {
  const a = Buffer.from(header ?? "")
  const b = Buffer.from(webhookSecret())
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  })
  const json = await res.json().catch(() => null)
  if (!json?.ok) throw new Error(`Telegram ${method}: ${json?.description ?? res.status}`)
  return json.result
}

/** Поставити вебхук на цей сайт (один раз; повторно — лише якщо змінилась адреса). */
export async function ensureWebhook(origin: string) {
  const url = `${origin.replace(/\/+$/, "")}/api/telegram`
  if (!/^https:\/\//.test(url)) return
  if ((await kvGet("tg_webhook").catch(() => null)) === url) return
  await tg("setWebhook", { url, secret_token: webhookSecret(), allowed_updates: ["message", "pre_checkout_query"], drop_pending_updates: false })
  await kvSet("tg_webhook", url)
}

/** Рахунок на оплату зірками для замовлення. */
export async function createStarsInvoice(code: string, stars: number, itemsText: string) {
  return (await tg("createInvoiceLink", {
    title: `EVILVERSE · ${code}`.slice(0, 32),
    description: `Замовлення ${code}: ${itemsText}`.slice(0, 255),
    payload: code,
    currency: "XTR",
    prices: [{ label: "EVILVERSE", amount: stars }],
  })) as string
}

type Update = {
  pre_checkout_query?: { id: string; currency: string; total_amount: number; invoice_payload: string; from?: { id: number; username?: string } }
  message?: {
    chat?: { id: number }
    text?: string
    successful_payment?: { currency: string; total_amount: number; invoice_payload: string; telegram_payment_charge_id: string }
  }
}

/** Обробка оновлення від Telegram. */
export async function handleUpdate(update: Update) {
  await ensureDeliveryColumns()
  const q = update.pre_checkout_query
  if (q) {
    const order = (await pool.query(
      "SELECT status, method, pay_amount FROM orders WHERE code = $1", [q.invoice_payload],
    )).rows[0]
    const ok = order && order.method === "stars" && order.status === "pending" && q.currency === "XTR" && Number(order.pay_amount) === q.total_amount
    await tg("answerPreCheckoutQuery", ok
      ? { pre_checkout_query_id: q.id, ok: true }
      : { pre_checkout_query_id: q.id, ok: false, error_message: order?.status === "paid" ? "Це замовлення вже оплачене." : "Замовлення не знайдено або воно застаріло. Створи нове на сайті." })
    return
  }

  const p = update.message?.successful_payment
  if (p) {
    const inserted = await pool.query(
      `INSERT INTO crypto_payments (id, network, code, amount, comment, paid_at) VALUES ($1, 'stars', $2, $3, $4, now())
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [`stars:${p.telegram_payment_charge_id}`, p.invoice_payload, p.total_amount, `charge ${p.telegram_payment_charge_id}`],
    )
    if (!inserted.rowCount) return
    const line = `Telegram Stars: +${p.total_amount} ⭐ (${new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}, charge ${p.telegram_payment_charge_id})`
    const done = await pool.query(
      `UPDATE orders SET status = 'paid', paid_at = now(), payment_log = COALESCE(payment_log, '[]'::jsonb) || $2::jsonb
       WHERE code = $1 AND status = 'pending' RETURNING code, nick, gift_to, total`,
      [p.invoice_payload, JSON.stringify([line, "оплату підтверджено автоматично"])],
    )
    const o = done.rows[0]
    if (!o) {
      void sendDiscordWebhook({
        allowed_mentions: { parse: [] },
        embeds: [{ title: `Зірки надійшли, але замовлення ${p.invoice_payload} не чекало оплати`, color: 0xffb300,
          description: `${p.total_amount} ⭐ · charge ${p.telegram_payment_charge_id}\nПеревір замовлення в /admin.html (можливо, його скасували).` }],
      })
    }
    if (o) {
      void sendDiscordWebhook({
        allowed_mentions: { parse: [] },
        embeds: [{ title: `Оплачено зірками Telegram: ${o.code}`, color: 0x7cff3b,
          fields: [
            { name: "Гравець", value: o.gift_to || o.nick, inline: true },
            { name: "Сума", value: `${p.total_amount} ⭐ (${o.total} грн)`, inline: true },
          ] }],
      })
    }
    if (update.message?.chat?.id) {
      await tg("sendMessage", { chat_id: update.message.chat.id, text: `✅ Оплату отримано! Замовлення ${p.invoice_payload} буде видано в грі протягом хвилини.` }).catch(() => {})
    }
    return
  }

  // Будь-яке інше повідомлення боту (напр. /start) — коротка підказка
  if (update.message?.chat?.id && update.message.text) {
    await tg("sendMessage", { chat_id: update.message.chat.id, text: "🔥 Це бот оплати EVILVERSE. Оформи замовлення на сайті й обери «Telegram Stars» — рахунок відкриється тут." }).catch(() => {})
  }
}

export async function starsStatus() {
  if (!starsConfigured()) return { configured: false as const }
  const [lastOk, lastError] = await Promise.all([kvGet("tg_webhook"), kvGet("stars_last_error")])
  return { configured: true as const, lastOk: lastOk ? `вебхук: ${lastOk}` : null, lastError, unmatched: [] }
}
