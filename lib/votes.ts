import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { NICK_RE } from "@/lib/catalog"
import { pool } from "@/lib/db"
import { ensureDeliveryColumns } from "@/lib/db/ensure"

/*
 * Голосування на моніторингах. Моніторинг після голосу сам стукає на /api/vote/<site>
 * з ніком і підписом (секретний ключ — у кабінеті моніторингу → змінна VOTE_SECRET_<SITE> у Vercel).
 * Прийнятий голос стає «замовленням» з товаром vote (method = vote, сума 0), а сервер видає
 * нагороду тим самим шляхом, що й покупки: команди для vote / vote_bonus — у config.yml HellPrime.
 *
 * Захист: підпис перевіряється, з одного моніторингу — один голос на нік за добу (за Києвом),
 * старі підписи (позначка часу старша за 36 год) не приймаються.
 */

type Params = Record<string, string>
type Verified = { nick: string; time?: string }

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex")
const md5 = (s: string) => createHash("md5").update(s).digest("hex")
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

function same(a: string, b: string) {
  const x = Buffer.from(String(a).toLowerCase())
  const y = Buffer.from(String(b).toLowerCase())
  return x.length === y.length && timingSafeEqual(x, y)
}

export const VOTE_SITES: Record<string, {
  name: string
  env: string
  verify: (p: Params, key: string) => Verified | null
}> = {
  // nick, time, sign = sha1(nick + time + secret)
  hotmc: {
    name: "HotMC",
    env: "VOTE_SECRET_HOTMC",
    verify: (p, key) => (same(p.sign ?? "", sha1(`${p.nick}${p.time}${key}`)) ? { nick: p.nick, time: p.time } : null),
  },
  // nickname, token = md5(nickname + secret)
  mctop: {
    name: "McTOP",
    env: "VOTE_SECRET_MCTOP",
    verify: (p, key) => (same(p.token ?? "", md5(`${p.nickname}${key}`)) ? { nick: p.nickname } : null),
  },
  // username, timestamp, signature = sha1(username + timestamp + secret)
  topcraft: {
    name: "TopCraft",
    env: "VOTE_SECRET_TOPCRAFT",
    verify: (p, key) => (same(p.signature ?? "", sha1(`${p.username}${p.timestamp}${key}`)) ? { nick: p.username, time: p.timestamp } : null),
  },
  // username, timestamp, signature = sha1(username + timestamp + secret)
  minecraftrating: {
    name: "MinecraftRating",
    env: "VOTE_SECRET_MINECRAFTRATING",
    verify: (p, key) => (same(p.signature ?? "", sha1(`${p.username}${p.timestamp}${key}`)) ? { nick: p.username, time: p.timestamp } : null),
  },
  // username, project, timestamp, signature = sha256(project.secret.timestamp.username)
  mineserv: {
    name: "MineServ",
    env: "VOTE_SECRET_MINESERV",
    verify: (p, key) =>
      same(p.signature ?? "", sha256([p.project, key, p.timestamp, p.username].join("."))) ? { nick: p.username, time: p.timestamp } : null,
  },
}

/** Позначка часу від моніторингу (секунди або мілісекунди). Якщо не число — не перевіряємо. */
function tooOld(time?: string) {
  if (!time || !/^\d{9,14}$/.test(time)) return false
  const ms = Number(time) > 1e12 ? Number(time) : Number(time) * 1000
  return Math.abs(Date.now() - ms) > 36 * 3600_000
}

const kyivDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date())

export type VoteResult = "ok" | "duplicate" | "bad_signature" | "bad_nick" | "stale" | "not_configured" | "unknown_site"

export async function acceptVote(siteId: string, params: Params): Promise<VoteResult> {
  const site = VOTE_SITES[siteId]
  if (!site) return "unknown_site"
  const key = (process.env[site.env] || "").trim()
  if (!key) return "not_configured"
  const v = site.verify(params, key)
  if (!v) return "bad_signature"
  if (!NICK_RE.test(v.nick ?? "")) return "bad_nick"
  if (tooOld(v.time)) return "stale"
  return recordVote(siteId, site.name, v.nick)
}

/** Голос, принятый сервером через Votifier (мониторинги без HTTP-скрипта, напр. MinecraftRating). */
export async function acceptServerVote(service: string, nick: string): Promise<VoteResult> {
  // «MinecraftRating» / «minecraftrating.ru» → minecraftrating, «McTOP» → mctop (зона домена отрезается только после точки)
  const siteId = service.toLowerCase().trim().replace(/\.[a-z]{2,6}$/, "").replace(/[^a-z0-9]/g, "").slice(0, 32) || "votifier"
  if (!NICK_RE.test(nick)) return "bad_nick"
  return recordVote(siteId, service.slice(0, 40) || siteId, nick)
}

async function recordVote(siteId: string, siteName: string, nick: string): Promise<VoteResult> {
  const v = { nick }
  const site = { name: siteName }
  await ensureDeliveryColumns()
  const day = kyivDay()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const ins = await client.query(
      `INSERT INTO votes (site, nick, day) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
      [siteId, v.nick, day],
    )
    if (!ins.rowCount) {
      await client.query("ROLLBACK")
      return "duplicate"
    }
    // кожен 5-й голос за місяць — бонус
    const month = day.slice(0, 7)
    const cnt = await client.query(
      `SELECT count(*)::int AS n FROM votes WHERE lower(nick) = lower($1) AND day LIKE $2`,
      [v.nick, `${month}-%`],
    )
    const n = cnt.rows[0]?.n ?? 1
    const items = [{ id: "vote", dur: "", qty: 1, unit: 0 }, ...(n % 5 === 0 ? [{ id: "vote_bonus", dur: "", qty: 1, unit: 0 }] : [])]
    const code = `VOTE-${randomBytes(4).toString("hex").toUpperCase()}`
    await client.query(
      `INSERT INTO orders (code, nick, discord, method, items, subtotal, discount, total, status, paid_at, payment_log)
       VALUES ($1, $2, '-', 'vote', $3, 0, 0, 0, 'paid', now(), $4)`,
      [code, v.nick, JSON.stringify(items), JSON.stringify([`голос: ${site.name}, ${n}-й за місяць`])],
    )
    await client.query(`UPDATE votes SET order_code = $1 WHERE id = $2`, [code, ins.rows[0].id])
    await client.query("COMMIT")
    return "ok"
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/** Топ голосуючих за поточний місяць (за Києвом). */
export async function topVoters(limit = 10) {
  await ensureDeliveryColumns()
  const month = kyivDay().slice(0, 7)
  const r = await pool.query(
    `SELECT min(nick) AS nick, count(*)::int AS votes FROM votes WHERE day LIKE $1
     GROUP BY lower(nick) ORDER BY votes DESC, min(created_at) ASC LIMIT $2`,
    [`${month}-%`, limit],
  )
  return { month, top: r.rows as { nick: string; votes: number }[] }
}

/* ── Призи топ-3 голосуючих за місяць ──────────────────────────────────────
 * 1-го числа (за Києвом) топ-3 минулого місяця отримують замовлення vote_top1..3,
 * а що саме видати (підписки на 14 днів) — вирішує config.yml HellPrime, як і для інших товарів.
 * Видача рівно один раз на місяць: прапорець у app_kv ставиться в тій самій транзакції.
 * Викликається з /api/delivery (сервер опитує сайт кожні ~15 с), окремий cron не потрібен.
 */
const TOP_PRIZES = ["vote_top1", "vote_top2", "vote_top3"]
let awardedMonth = ""

function previousMonth(): string {
  const [y, m] = kyivDay().slice(0, 7).split("-").map(Number)
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
}

export async function awardMonthlyTopVoters(): Promise<string[]> {
  const month = previousMonth()
  if (awardedMonth === month) return []
  await ensureDeliveryColumns()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const flag = await client.query(
      `INSERT INTO app_kv (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING key`,
      [`vote_top_awarded:${month}`, new Date().toISOString()],
    )
    if (!flag.rowCount) {
      await client.query("ROLLBACK")
      awardedMonth = month
      return []
    }
    const top = await client.query(
      `SELECT min(nick) AS nick, count(*)::int AS votes FROM votes WHERE day LIKE $1
       GROUP BY lower(nick) ORDER BY votes DESC, min(created_at) ASC LIMIT 3`,
      [`${month}-%`],
    )
    const codes: string[] = []
    for (let i = 0; i < top.rows.length; i++) {
      const { nick, votes } = top.rows[i] as { nick: string; votes: number }
      if (!NICK_RE.test(nick)) continue
      const code = `VTOP-${randomBytes(4).toString("hex").toUpperCase()}`
      await client.query(
        `INSERT INTO orders (code, nick, discord, method, items, subtotal, discount, total, status, paid_at, payment_log)
         VALUES ($1, $2, '-', 'vote', $3, 0, 0, 0, 'paid', now(), $4)`,
        [code, nick, JSON.stringify([{ id: TOP_PRIZES[i], dur: "", qty: 1, unit: 0 }]),
          JSON.stringify([`топ-${i + 1} голосуючих за ${month}: ${votes} голосів`])],
      )
      codes.push(code)
    }
    await client.query("COMMIT")
    awardedMonth = month
    return codes
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
