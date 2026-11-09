import { pool } from "@/lib/db"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { sendDiscordWebhook } from "@/lib/server-utils"

/*
 * Автоматична оплата через банку monobank.
 *   MONO_TOKEN — особистий токен з api.monobank.ua (лише читання виписки, переказувати гроші ним не можна)
 *   MONO_JAR   — посилання на банку, напр. https://send.monobank.ua/jar/AbCdEf123
 *
 * Гравець платить у банку будь-якою карткою й пише в коментарі код замовлення (EV-XXXXXX).
 * Раз на хвилину (ліміт monobank) сайт читає виписку банки, знаходить код і позначає замовлення оплаченим,
 * а Minecraft-сервер забирає його вже звичним шляхом (/api/delivery).
 */

const API = process.env.MONO_API_BASE || "https://api.monobank.ua"
const MIN_INTERVAL_MS = 61_000
const LOOKBACK_MS = 7 * 24 * 3600_000

export function monoJarLink() {
  const link = (process.env.MONO_JAR ?? "").trim()
  return /^https:\/\/send\.monobank\.ua\/[\w/-]+$/.test(link) ? link.replace(/\/+$/, "") : null
}

export function monoConfigured() {
  return Boolean(process.env.MONO_TOKEN?.trim() && monoJarLink())
}

// Кирилиця, схожа на латиницю (гравці часто набирають код в українській розкладці)
const LOOKALIKE: Record<string, string> = { А: "A", В: "B", С: "C", Е: "E", Є: "E", Н: "H", К: "K", М: "M", О: "O", Р: "P", Т: "T", Х: "X", І: "I", У: "Y", Ї: "I" }

/** Нормалізований текст коментаря: верхній регістр, кирилиця → латиниця, лише літери й цифри. */
export function normalizeComment(text: string) {
  return text
    .toUpperCase()
    .replace(/[А-ЯЄІЇҐ]/g, (c) => LOOKALIKE[c] ?? c)
    .replace(/[^A-Z0-9]/g, "")
}

/** Чи містить коментар код замовлення (з префіксом EV чи без нього). */
export function commentHasCode(comment: string, code: string) {
  const suffix = code.replace(/^EV-/, "")
  return normalizeComment(comment).includes(suffix)
}

async function kvGet(key: string) {
  const r = await pool.query("SELECT value FROM app_kv WHERE key = $1", [key])
  return (r.rows[0]?.value as string | undefined) ?? null
}
async function kvSet(key: string, value: string) {
  await pool.query("INSERT INTO app_kv (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", [key, value])
}

/** Не частіше ніж раз на хвилину на всі копії сайту одразу (атомарно в базі). */
async function takeSlot() {
  const now = Date.now()
  const r = await pool.query(
    `INSERT INTO app_kv (key, value) VALUES ('mono_last_call', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1 WHERE app_kv.value::bigint <= $2
     RETURNING key`,
    [String(now), now - MIN_INTERVAL_MS],
  )
  return r.rowCount === 1
}

async function monoGet(path: string) {
  const res = await fetch(API + path, {
    headers: { "X-Token": process.env.MONO_TOKEN!.trim() },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`monobank ${res.status}`)
  return res.json()
}

/** id банки для виписки: шукаємо банку з посилання серед банок клієнта (кешується в базі). */
async function jarId(): Promise<string | null> {
  const link = monoJarLink()!
  const segment = link.split("/").pop()!
  const cacheKey = `mono_jar_id:${segment}`
  const cached = await kvGet(cacheKey)
  if (cached) return cached
  const info = await monoGet("/personal/client-info")
  const jars: { id: string; sendId?: string; title?: string }[] = info?.jars ?? []
  const jar = jars.find((j) => j.sendId && (j.sendId === segment || j.sendId.endsWith("/" + segment) || j.sendId.endsWith(segment)))
    ?? (jars.length === 1 ? jars[0] : undefined)
  if (!jar) throw new Error(`банку з посиланням ${link} не знайдено серед банок цього токена (${jars.length} шт.)`)
  await kvSet(cacheKey, jar.id)
  return null // client-info вже використав хвилинний ліміт — виписку читаємо наступного разу
}

type StatementItem = { id: string; time: number; amount: number; comment?: string; description?: string }
type PendingOrder = { code: string; total: number; created_at: Date; nick: string; gift_to: string | null }

let running: Promise<void> | null = null

/** Перевірити банку й позначити оплачені замовлення. Безпечно викликати часто — сам обмежує частоту. */
export function checkMonoPayments(): Promise<void> {
  if (!monoConfigured()) return Promise.resolve()
  running ??= run()
    .catch(async (error) => {
      console.error("[mono]", error)
      await kvSet("mono_last_error", `${new Date().toISOString()} ${String(error?.message ?? error)}`).catch(() => {})
    })
    .finally(() => { running = null })
  return running
}

async function run() {
  await ensureDeliveryColumns()
  const pending = (await pool.query(
    `SELECT code, total, created_at, nick, gift_to FROM orders
     WHERE method = 'mono' AND status = 'pending' AND is_demo = false AND created_at > now() - interval '7 days'`,
  )).rows as PendingOrder[]
  if (!pending.length) return
  if (!(await takeSlot())) return

  const id = await jarId()
  if (!id) return
  const oldest = Math.min(...pending.map((o) => new Date(o.created_at).getTime()))
  const from = Math.floor(Math.max(oldest - 10 * 60_000, Date.now() - LOOKBACK_MS) / 1000)
  const to = Math.floor(Date.now() / 1000)
  const items = (await monoGet(`/personal/statement/${encodeURIComponent(id)}/${from}/${to}`)) as StatementItem[]
  await kvSet("mono_last_ok", new Date().toISOString())

  for (const item of items) {
    if (!(item.amount > 0)) continue
    const text = `${item.comment ?? ""} ${item.description ?? ""}`
    const order = pending.find((o) => commentHasCode(text, o.code))
    const inserted = await pool.query(
      `INSERT INTO mono_payments (id, code, amount, comment, paid_at) VALUES ($1, $2, $3, $4, to_timestamp($5))
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [String(item.id), order?.code ?? null, Math.round(item.amount), text.trim().slice(0, 300), item.time],
    )
    if (!inserted.rowCount) continue // цей платіж уже враховано

    if (!order) {
      void sendDiscordWebhook({
        allowed_mentions: { parse: [] },
        embeds: [{ title: "Платіж у банку без коду замовлення", color: 0xffb300,
          description: `${(item.amount / 100).toFixed(2)} грн · «${text.trim().slice(0, 200) || "без коментаря"}»\nЗнайди замовлення в /admin.html і підтверди вручну.` }],
      })
      continue
    }

    const sum = Number((await pool.query("SELECT COALESCE(SUM(amount), 0) AS s FROM mono_payments WHERE code = $1", [order.code])).rows[0].s)
    const line = `monobank: +${(item.amount / 100).toFixed(2)} грн (${new Date(item.time * 1000).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })})`
    if (sum >= order.total * 100) {
      const done = await pool.query(
        `UPDATE orders SET status = 'paid', paid_at = now(), payment_log = COALESCE(payment_log, '[]'::jsonb) || $2::jsonb
         WHERE code = $1 AND status = 'pending' RETURNING code`,
        [order.code, JSON.stringify([line, "оплату підтверджено автоматично"])],
      )
      if (done.rowCount) {
        pending.splice(pending.indexOf(order), 1)
        void sendDiscordWebhook({
          allowed_mentions: { parse: [] },
          embeds: [{ title: `Оплачено через monobank: ${order.code}`, color: 0x7cff3b,
            fields: [
              { name: "Гравець", value: order.gift_to || order.nick, inline: true },
              { name: "Сума", value: `${(sum / 100).toFixed(2)} грн`, inline: true },
            ] }],
        })
      }
    } else {
      await pool.query(
        `UPDATE orders SET payment_log = COALESCE(payment_log, '[]'::jsonb) || $2::jsonb WHERE code = $1`,
        [order.code, JSON.stringify([`${line} — замало: разом ${(sum / 100).toFixed(2)} з ${order.total} грн`])],
      )
      void sendDiscordWebhook({
        allowed_mentions: { parse: [] },
        embeds: [{ title: `Недоплата ${order.code}`, color: 0xffb300,
          description: `Надійшло ${(sum / 100).toFixed(2)} з ${order.total} грн. Перевір і підтверди вручну в /admin.html.` }],
      })
    }
  }
}

/** Стан інтеграції для адмін-сторінки. */
export async function monoStatus() {
  if (!monoConfigured()) return { configured: false as const }
  const [lastOk, lastError] = await Promise.all([kvGet("mono_last_ok"), kvGet("mono_last_error")])
  const unmatched = (await pool.query(
    `SELECT id, amount, comment, paid_at FROM mono_payments WHERE code IS NULL AND paid_at > now() - interval '7 days' ORDER BY paid_at DESC LIMIT 20`,
  )).rows.map((r) => ({ id: r.id as string, amount: Number(r.amount) / 100, comment: r.comment as string, paidAt: r.paid_at as Date }))
  return { configured: true as const, lastOk, lastError, unmatched }
}
