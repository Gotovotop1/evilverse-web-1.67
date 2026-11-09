import { pool } from "@/lib/db"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { kvGet, kvSet, takeSlot } from "@/lib/kv"
import { sendDiscordWebhook } from "@/lib/server-utils"

/*
 * Автоматична оплата USDT у мережі TRON (TRC20).
 * У TRC20-переказів немає коментаря, тому кожне замовлення отримує УНІКАЛЬНУ суму з точністю до тисячних
 * (напр. 1.337 USDT) — за нею сайт і впізнає платіж. Зараховується лише офіційний USDT (контракт Tether).
 */

export const TRON_WALLET = (process.env.TRON_WALLET ?? "TD3okxejs9zbeMELTBusYBeeXCUYZkndhE").trim()
export const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
const API = process.env.TRONGRID_BASE || "https://api.trongrid.io"
const MIN_INTERVAL_MS = 30_000
const TOLERANCE = 1.05 // неточна сума (до +5% зверху) — лише коли неоплачене TRC20-замовлення взагалі одне

export function tronConfigured() {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(TRON_WALLET)
}

const toMilli = (usdt: string | number) => Math.round(Number(usdt) * 1000)

/** Унікальна сума для нового замовлення: базова ціна + 0.001…0.099, якої немає серед неоплачених TRC20-замовлень. */
export async function uniqueTronAmount(base: string) {
  const taken = new Set(
    (await pool.query(
      `SELECT pay_amount FROM orders WHERE method = 'crypto' AND status = 'pending' AND created_at > now() - interval '7 days' AND pay_amount IS NOT NULL`,
    )).rows.map((r) => toMilli(r.pay_amount)),
  )
  const baseMilli = toMilli(base)
  const free: number[] = []
  for (let k = 1; k <= 99; k++) if (!taken.has(baseMilli + k)) free.push(k)
  const k = free.length ? free[Math.floor(Math.random() * free.length)] : 100 + Math.floor(Math.random() * 900)
  return ((baseMilli + k) / 1000).toFixed(3)
}

type Trc20Tx = { transaction_id: string; block_timestamp: number; from?: string; to?: string; value?: string; type?: string; token_info?: { address?: string; decimals?: number } }
type PendingOrder = { code: string; total: number; pay_amount: string; nick: string; gift_to: string | null; created_at: Date }

let running: Promise<void> | null = null

export function checkTronPayments(): Promise<void> {
  if (!tronConfigured()) return Promise.resolve()
  running ??= run()
    .catch(async (error) => {
      console.error("[tron]", error)
      await kvSet("tron_last_error", `${new Date().toISOString()} ${String(error?.message ?? error)}`).catch(() => {})
    })
    .finally(() => { running = null })
  return running
}

async function run() {
  await ensureDeliveryColumns()
  const pending = (await pool.query(
    `SELECT code, total, pay_amount, nick, gift_to, created_at FROM orders
     WHERE method = 'crypto' AND status = 'pending' AND is_demo = false AND pay_amount IS NOT NULL AND created_at > now() - interval '7 days'`,
  )).rows as PendingOrder[]
  if (!pending.length) return
  if (!(await takeSlot("tron_last_call", MIN_INTERVAL_MS))) return

  const oldest = Math.min(...pending.map((o) => new Date(o.created_at).getTime()))
  const url = `${API}/v1/accounts/${TRON_WALLET}/transactions/trc20?only_to=true&only_confirmed=true&limit=50&contract_address=${USDT_TRC20}&min_timestamp=${oldest - 10 * 60_000}`
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...(process.env.TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY } : {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`TronGrid ${res.status}`)
  const txs = ((await res.json())?.data ?? []) as Trc20Tx[]
  await kvSet("tron_last_ok", new Date().toISOString())

  // від старіших до новіших — щоб замовлення закривались у порядку оплат
  for (const tx of [...txs].sort((a, b) => a.block_timestamp - b.block_timestamp)) {
    if (tx.type && tx.type !== "Transfer") continue
    if (tx.token_info?.address !== USDT_TRC20 || tx.to !== TRON_WALLET) continue
    const micro = Number(tx.value ?? 0)
    if (!(micro > 0)) continue
    const milli = Math.round(micro / 1000)
    const paidAt = tx.block_timestamp
    const eligible = pending.filter((o) => new Date(o.created_at).getTime() - 10 * 60_000 <= paidAt)
    let order = eligible.find((o) => toMilli(o.pay_amount) === milli)
    // Без точного збігу вгадувати не можна (можна зарахувати чужому замовленню на той самий товар),
    // тож неточну суму приймаємо лише тоді, коли чекає оплати рівно одне замовлення.
    if (!order && pending.length === 1 && eligible.length === 1) {
      const only = eligible[0]
      if (milli >= toMilli(only.pay_amount) && milli <= toMilli(only.pay_amount) * TOLERANCE) order = only
    }
    const inserted = await pool.query(
      `INSERT INTO crypto_payments (id, network, code, amount, comment, paid_at) VALUES ($1, 'tron', $2, $3, $4, to_timestamp($5))
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [`tron:${tx.transaction_id}`, order?.code ?? null, micro, `від ${tx.from ?? "?"}`, Math.floor(paidAt / 1000)],
    )
    if (!inserted.rowCount) continue

    const usdt = (micro / 1e6).toFixed(3)
    if (!order) {
      void sendDiscordWebhook({
        allowed_mentions: { parse: [] },
        embeds: [{ title: "USDT (TRC20): сума не збіглася з жодним замовленням", color: 0xffb300,
          description: `${usdt} USDT від ${tx.from ?? "?"}\nЗнайди замовлення в /admin.html і підтверди вручну.` }],
      })
      continue
    }
    const line = `USDT (TRC20): +${usdt} USDT (${new Date(paidAt).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })})`
    const done = await pool.query(
      `UPDATE orders SET status = 'paid', paid_at = now(), payment_log = COALESCE(payment_log, '[]'::jsonb) || $2::jsonb
       WHERE code = $1 AND status = 'pending' RETURNING code`,
      [order.code, JSON.stringify([line, "оплату підтверджено автоматично"])],
    )
    if (done.rowCount) {
      pending.splice(pending.indexOf(order), 1)
      void sendDiscordWebhook({
        allowed_mentions: { parse: [] },
        embeds: [{ title: `Оплачено USDT (TRC20): ${order.code}`, color: 0x7cff3b,
          fields: [
            { name: "Гравець", value: order.gift_to || order.nick, inline: true },
            { name: "Сума", value: `${usdt} USDT (${order.total} грн)`, inline: true },
          ] }],
      })
    }
  }
}

export async function tronStatus() {
  if (!tronConfigured()) return { configured: false as const }
  const [lastOk, lastError] = await Promise.all([kvGet("tron_last_ok"), kvGet("tron_last_error")])
  const unmatched = (await pool.query(
    `SELECT id, amount, comment, paid_at FROM crypto_payments WHERE network = 'tron' AND code IS NULL AND paid_at > now() - interval '7 days' ORDER BY paid_at DESC LIMIT 20`,
  )).rows.map((r) => ({ id: r.id as string, amount: Number(r.amount) / 1e6, comment: r.comment as string, paidAt: r.paid_at as Date }))
  return { configured: true as const, lastOk, lastError, unmatched }
}
