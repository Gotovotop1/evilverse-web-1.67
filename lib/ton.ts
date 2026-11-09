import { pool } from "@/lib/db"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { kvGet, kvSet, takeSlot } from "@/lib/kv"
import { commentHasCode } from "@/lib/mono"
import { sendDiscordWebhook } from "@/lib/server-utils"

/*
 * Автоматична оплата USDT у мережі TON.
 * Гравець переказує USDT на гаманець сервера з кодом замовлення в коментарі (як із банкою monobank).
 * Сайт раз на ~30 с читає історію гаманця через TonAPI і позначає замовлення оплаченим.
 * Зараховується ЛИШЕ офіційний USDT (майстер-контракт Tether), підробні токени з такою ж назвою ігноруються.
 */

export const TON_WALLET = (process.env.TON_WALLET ?? "UQBrosShuG0N8uxCIa_uUeHs1i-eDErRZryob2HIYHqPeqUh").trim()
export const USDT_TON_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
const API = process.env.TONAPI_BASE || "https://tonapi.io"
const MIN_INTERVAL_MS = 30_000
const ACCEPT_RATIO = 0.97 // допуск на округлення/курс

/** Будь-яка форма адреси TON (сира 0:hex чи дружня base64) → сира "0:hex" у нижньому регістрі. */
export function toRawAddress(address: string): string | null {
  const a = String(address ?? "").trim()
  const raw = a.match(/^(-?\d+):([0-9a-fA-F]{64})$/)
  if (raw) return `${raw[1]}:${raw[2].toLowerCase()}`
  if (!/^[A-Za-z0-9_\-+/]{48}$/.test(a)) return null
  const bytes = Buffer.from(a.replace(/-/g, "+").replace(/_/g, "/"), "base64")
  if (bytes.length !== 36) return null
  const workchain = bytes[1] === 0xff ? -1 : bytes[1]
  return `${workchain}:${bytes.subarray(2, 34).toString("hex")}`
}

const WALLET_RAW = () => toRawAddress(TON_WALLET)
const USDT_RAW = toRawAddress(USDT_TON_MASTER)!

export function tonConfigured() {
  return Boolean(WALLET_RAW())
}

type JettonTransfer = {
  sender?: { address?: string }
  recipient?: { address?: string }
  amount?: string
  comment?: string
  jetton?: { address?: string; decimals?: number }
}
type TonEvent = {
  event_id: string
  timestamp: number
  in_progress?: boolean
  actions?: { type?: string; status?: string; JettonTransfer?: JettonTransfer }[]
}
type PendingOrder = { code: string; total: number; pay_amount: string | null; nick: string; gift_to: string | null }

let running: Promise<void> | null = null

export function checkTonPayments(): Promise<void> {
  if (!tonConfigured()) return Promise.resolve()
  running ??= run()
    .catch(async (error) => {
      console.error("[ton]", error)
      await kvSet("ton_last_error", `${new Date().toISOString()} ${String(error?.message ?? error)}`).catch(() => {})
    })
    .finally(() => { running = null })
  return running
}

async function run() {
  await ensureDeliveryColumns()
  const pending = (await pool.query(
    `SELECT code, total, pay_amount, nick, gift_to FROM orders
     WHERE method = 'ton' AND status = 'pending' AND is_demo = false AND created_at > now() - interval '7 days'`,
  )).rows as PendingOrder[]
  if (!pending.length) return
  if (!(await takeSlot("ton_last_call", MIN_INTERVAL_MS))) return

  const startDate = Math.floor((Date.now() - 7 * 24 * 3600_000) / 1000)
  const res = await fetch(`${API}/v2/accounts/${encodeURIComponent(TON_WALLET)}/events?limit=50&start_date=${startDate}`, {
    headers: { Accept: "application/json", ...(process.env.TONAPI_KEY ? { Authorization: `Bearer ${process.env.TONAPI_KEY}` } : {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  })
  if (res.status === 404) { await kvSet("ton_last_ok", new Date().toISOString()); return } // гаманець ще без жодної транзакції
  if (!res.ok) throw new Error(`TonAPI ${res.status}`)
  const events = ((await res.json())?.events ?? []) as TonEvent[]
  await kvSet("ton_last_ok", new Date().toISOString())

  const wallet = WALLET_RAW()
  for (const event of events) {
    if (event.in_progress) continue // ще не підтверджено мережею — перевіримо наступного разу
    for (const [index, action] of (event.actions ?? []).entries()) {
      const t = action.JettonTransfer
      if (action.type !== "JettonTransfer" || action.status !== "ok" || !t) continue
      if (toRawAddress(t.jetton?.address ?? "") !== USDT_RAW) continue
      if (toRawAddress(t.recipient?.address ?? "") !== wallet) continue
      const micro = Number(t.amount ?? 0) // USDT має 6 знаків після коми
      if (!(micro > 0)) continue
      const comment = String(t.comment ?? "")
      const order = pending.find((o) => commentHasCode(comment, o.code))
      const inserted = await pool.query(
        `INSERT INTO crypto_payments (id, network, code, amount, comment, paid_at) VALUES ($1, 'ton', $2, $3, $4, to_timestamp($5))
         ON CONFLICT (id) DO NOTHING RETURNING id`,
        [`ton:${event.event_id}:${index}`, order?.code ?? null, micro, comment.slice(0, 300), event.timestamp],
      )
      if (!inserted.rowCount) continue

      const usdt = (micro / 1e6).toFixed(2)
      if (!order) {
        void sendDiscordWebhook({
          allowed_mentions: { parse: [] },
          embeds: [{ title: "USDT (TON) без коду замовлення", color: 0xffb300,
            description: `${usdt} USDT · «${comment.slice(0, 200) || "без коментаря"}»\nЗнайди замовлення в /admin.html і підтверди вручну.` }],
        })
        continue
      }
      const sum = Number((await pool.query("SELECT COALESCE(SUM(amount), 0) AS s FROM crypto_payments WHERE code = $1", [order.code])).rows[0].s)
      const expected = Math.round(Number(order.pay_amount ?? 0) * 1e6)
      const line = `USDT (TON): +${usdt} USDT (${new Date(event.timestamp * 1000).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })})`
      if (expected > 0 && sum >= expected * ACCEPT_RATIO) {
        const done = await pool.query(
          `UPDATE orders SET status = 'paid', paid_at = now(), payment_log = COALESCE(payment_log, '[]'::jsonb) || $2::jsonb
           WHERE code = $1 AND status = 'pending' RETURNING code`,
          [order.code, JSON.stringify([line, "оплату підтверджено автоматично"])],
        )
        if (done.rowCount) {
          pending.splice(pending.indexOf(order), 1)
          void sendDiscordWebhook({
            allowed_mentions: { parse: [] },
            embeds: [{ title: `Оплачено USDT (TON): ${order.code}`, color: 0x7cff3b,
              fields: [
                { name: "Гравець", value: order.gift_to || order.nick, inline: true },
                { name: "Сума", value: `${(sum / 1e6).toFixed(2)} USDT (${order.total} грн)`, inline: true },
              ] }],
          })
        }
      } else {
        await pool.query(
          `UPDATE orders SET payment_log = COALESCE(payment_log, '[]'::jsonb) || $2::jsonb WHERE code = $1`,
          [order.code, JSON.stringify([`${line} — замало: разом ${(sum / 1e6).toFixed(2)} з ${order.pay_amount} USDT`])],
        )
        void sendDiscordWebhook({
          allowed_mentions: { parse: [] },
          embeds: [{ title: `Недоплата USDT ${order.code}`, color: 0xffb300,
            description: `Надійшло ${(sum / 1e6).toFixed(2)} з ${order.pay_amount} USDT. Перевір і підтверди вручну в /admin.html.` }],
        })
      }
    }
  }
}

export async function tonStatus() {
  if (!tonConfigured()) return { configured: false as const }
  const [lastOk, lastError] = await Promise.all([kvGet("ton_last_ok"), kvGet("ton_last_error")])
  const unmatched = (await pool.query(
    `SELECT id, amount, comment, paid_at FROM crypto_payments WHERE network = 'ton' AND code IS NULL AND paid_at > now() - interval '7 days' ORDER BY paid_at DESC LIMIT 20`,
  )).rows.map((r) => ({ id: r.id as string, amount: Number(r.amount) / 1e6, comment: r.comment as string, paidAt: r.paid_at as Date }))
  return { configured: true as const, lastOk, lastError, unmatched }
}
