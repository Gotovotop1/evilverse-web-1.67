import { createHash } from "node:crypto"
import { pool } from "@/lib/db"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { kvGet, kvSet, takeSlot } from "@/lib/kv"
import { commentHasCode } from "@/lib/mono"
import { sendDiscordWebhook } from "@/lib/server-utils"

/*
 * Оплата рублями (СБП / картки РФ) через DonatePay.
 *   DONATEPAY_TOKEN — API-ключ із кабінету DonatePay (розділ API)
 *   DONATEPAY_NAME  — твій нік на DonatePay (сторінка https://new.donatepay.ru/<нік>)
 * Гравець відкриває сторінку DonatePay з уже вписаними сумою в рублях і кодом замовлення в повідомленні.
 * Сайт раз на ~25 с (ліміт DonatePay — 1 запит на 20 с) читає успішні донати й шукає код у коментарі.
 */

const API = process.env.DONATEPAY_API || "https://donatepay.ru/api/v1"
const PAGE = process.env.DONATEPAY_PAGE || "https://new.donatepay.ru"
const MIN_INTERVAL_MS = 25_000
const ACCEPT_RATIO = 0.97

// DONATEPAY_NAME — нік на DonatePay (напр. Tar4ks) АБО повне посилання на твою сторінку донату
// (напр. https://new.donatepay.ru/@1542675) — тоді воно береться як є.
const pageBase = (): string | null => {
  const raw = (process.env.DONATEPAY_NAME ?? "").trim()
  if (/^https:\/\/([a-z0-9-]+\.)?donatepay\.(ru|eu)\/[^\s?#]+$/i.test(raw)) return raw.replace(/\/+$/, "")
  const nick = raw.replace(/^@/, "")
  return /^[\w.-]{2,64}$/.test(nick) ? `${PAGE}/${encodeURIComponent(nick)}` : null
}

export function donatepayConfigured() {
  return Boolean(process.env.DONATEPAY_TOKEN?.trim() && pageBase())
}

/** Посилання на сторінку оплати з уже заповненими ім'ям (ніком гравця), сумою й кодом. */
export function donatepayLink(rub: number, code: string, name: string) {
  const u = new URL(pageBase()!)
  u.searchParams.set("name", name)
  u.searchParams.set("amount", String(rub))
  u.searchParams.set("currency", "RUB")
  u.searchParams.set("message", code)
  return u.toString()
}

type DpTransaction = {
  id?: number | string
  sum?: number | string
  currency?: string
  comment?: string
  what?: string
  status?: string
  type?: string
  created_at?: string | { date?: string }
  vars?: { comment?: string; message?: string; name?: string }
}
type PendingOrder = { code: string; total: number; pay_amount: string; nick: string; gift_to: string | null }

let running: Promise<void> | null = null

export function checkDonatepayPayments(): Promise<void> {
  if (!donatepayConfigured()) return Promise.resolve()
  running ??= run()
    .catch(async (error) => {
      console.error("[donatepay]", error)
      await kvSet("donatepay_last_error", `${new Date().toISOString()} ${String(error?.message ?? error)}`).catch(() => {})
    })
    .finally(() => { running = null })
  return running
}

const createdAt = (t: DpTransaction) => {
  const raw = typeof t.created_at === "string" ? t.created_at : t.created_at?.date
  const ms = raw ? Date.parse(raw.replace(" ", "T")) : NaN
  return Number.isFinite(ms) ? ms : Date.now()
}

async function run() {
  await ensureDeliveryColumns()
  const pending = (await pool.query(
    `SELECT code, total, pay_amount, nick, gift_to FROM orders
     WHERE method = 'donatepay' AND status = 'pending' AND is_demo = false AND created_at > now() - interval '7 days'`,
  )).rows as PendingOrder[]
  if (!pending.length) return
  if (!(await takeSlot("donatepay_last_call", MIN_INTERVAL_MS))) return

  const url = `${API}/transactions?access_token=${encodeURIComponent(process.env.DONATEPAY_TOKEN!.trim())}&limit=50&status=success&type=donation&order=DESC`
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) })
  const body = await res.text()
  if (!res.ok || /Too Many Requests/i.test(body)) throw new Error(`DonatePay ${res.status}${res.status === 200 ? " (Too Many Requests)" : ""}`)
  const json = JSON.parse(body)
  if (json?.status && json.status !== "success") throw new Error(`DonatePay: ${String(json?.message ?? json.status).slice(0, 200)}`)
  const list = (Array.isArray(json?.data) ? json.data : []) as DpTransaction[]
  await kvSet("donatepay_last_ok", new Date().toISOString())

  for (const t of list) {
    if (t.status && t.status !== "success") continue
    if (t.type && t.type !== "donation") continue
    const currency = String(t.currency ?? "RUB").toUpperCase()
    const sum = Number(t.sum ?? 0)
    if (!(sum > 0)) continue
    const comment = String(t.comment ?? t.vars?.comment ?? t.vars?.message ?? "")
    const when = createdAt(t)
    const id = `donatepay:${t.id ?? createHash("sha1").update(`${comment}|${sum}|${JSON.stringify(t.created_at ?? "")}`).digest("hex")}`
    const order = currency === "RUB" ? pending.find((o) => commentHasCode(comment, o.code)) : undefined

    const inserted = await pool.query(
      `INSERT INTO crypto_payments (id, network, code, amount, comment, paid_at) VALUES ($1, 'donatepay', $2, $3, $4, to_timestamp($5))
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [id, order?.code ?? null, Math.round(sum * 100), `${comment} (${currency})`.slice(0, 300), Math.floor(when / 1000)],
    )
    if (!inserted.rowCount) continue

    if (!order) {
      // старі донати без коду (або вже оплачені) не чіпаємо — лише показуємо в адмінці, якщо вони свіжі
      continue
    }
    const paid = Number((await pool.query("SELECT COALESCE(SUM(amount), 0) AS s FROM crypto_payments WHERE code = $1", [order.code])).rows[0].s) / 100
    const expected = Number(order.pay_amount)
    const line = `DonatePay: +${sum} ₽ (${new Date(when).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })})`
    if (paid >= expected * ACCEPT_RATIO) {
      const done = await pool.query(
        `UPDATE orders SET status = 'paid', paid_at = now(), payment_log = COALESCE(payment_log, '[]'::jsonb) || $2::jsonb
         WHERE code = $1 AND status = 'pending' RETURNING code`,
        [order.code, JSON.stringify([line, "оплату підтверджено автоматично"])],
      )
      if (done.rowCount) {
        pending.splice(pending.indexOf(order), 1)
        void sendDiscordWebhook({
          allowed_mentions: { parse: [] },
          embeds: [{ title: `Оплачено через DonatePay: ${order.code}`, color: 0x7cff3b,
            fields: [
              { name: "Гравець", value: order.gift_to || order.nick, inline: true },
              { name: "Сума", value: `${paid} ₽ (${order.total} грн)`, inline: true },
            ] }],
        })
      }
    } else {
      await pool.query(
        `UPDATE orders SET payment_log = COALESCE(payment_log, '[]'::jsonb) || $2::jsonb WHERE code = $1`,
        [order.code, JSON.stringify([`${line} — замало: разом ${paid} з ${expected} ₽`])],
      )
    }
  }
}

export async function donatepayStatus() {
  if (!donatepayConfigured()) return { configured: false as const }
  const [lastOk, lastError] = await Promise.all([kvGet("donatepay_last_ok"), kvGet("donatepay_last_error")])
  const unmatched = (await pool.query(
    `SELECT id, amount, comment, paid_at FROM crypto_payments WHERE network = 'donatepay' AND code IS NULL AND paid_at > now() - interval '3 days' ORDER BY paid_at DESC LIMIT 20`,
  )).rows.map((r) => ({ id: r.id as string, amount: Number(r.amount) / 100, comment: r.comment as string, paidAt: r.paid_at as Date }))
  return { configured: true as const, lastOk, lastError, unmatched }
}
