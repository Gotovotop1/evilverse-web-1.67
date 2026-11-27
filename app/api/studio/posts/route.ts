import { pool } from "@/lib/db"
import { authed, fail, json, preflight } from "@/lib/studio/core"
import { isPlatform } from "@/lib/studio/platforms"
import { processDue } from "@/lib/studio/worker"

export const dynamic = "force-dynamic"
export const maxDuration = 60
export const OPTIONS = preflight

const TT_PRIVACY = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"]
const YT_PRIVACY = ["public", "unlisted", "private"]

/** Мои публикации (последние 200) + заодно выкладываем то, чьё время уже пришло. */
export const GET = authed(async (req, u) => {
  if (new URL(req.url).searchParams.get("run") === "1") await processDue({ userId: u.id, limit: 2, budgetMs: 15_000 }).catch((e) => console.error(e))
  const r = await pool.query(
    `SELECT p.id, p.video_id, p.platform, p.title, p.caption, p.privacy, p.scheduled_at, p.status, p.attempts, p.remote_url, p.error, p.updated_at,
            v.url AS video_url, v.deleted_at IS NOT NULL AS video_deleted, v.duration, v.title AS video_title
       FROM studio_posts p JOIN studio_videos v ON v.id = p.video_id
      WHERE p.user_id = $1 ORDER BY (p.status IN ('scheduled','processing','uploaded')) DESC, p.scheduled_at DESC LIMIT 200`, [u.id])
  return json(req, { posts: r.rows.map((x) => ({ ...x, id: String(x.id), video_id: String(x.video_id), video_url: x.video_deleted ? null : x.video_url })), now: new Date().toISOString() })
})

/**
 * Запланировать публикации: { items: [{ videoId, platform, at, caption, title?, privacy? }] }.
 * Каждая платформа — отдельная публикация, чтобы у каждой был свой статус и своя ссылка.
 */
export const POST = authed(async (req, u) => {
  const b = await req.json().catch(() => ({})) as { items?: any[] }
  const items = Array.isArray(b.items) ? b.items : []
  if (!items.length || items.length > 40) return fail(req, "Нужно от 1 до 40 публикаций за раз")
  const pending = await pool.query(`SELECT count(*)::int AS n FROM studio_posts WHERE user_id = $1 AND status IN ('scheduled','processing')`, [u.id])
  if (pending.rows[0].n + items.length > 150) return fail(req, "В расписании уже слишком много публикаций (больше 150)", 429)
  const socials = new Set((await pool.query(`SELECT platform FROM studio_social WHERE user_id = $1 AND broken IS NULL`, [u.id])).rows.map((r) => r.platform))
  const now = Date.now(), rows: any[] = []
  for (const it of items) {
    const platform = String(it.platform), at = new Date(it.at).getTime(), videoId = Number(it.videoId)
    if (!isPlatform(platform)) return fail(req, "Неизвестная соцсеть: " + platform)
    if (!socials.has(platform)) return fail(req, `Сначала подключи ${platform}`, 400, { code: "not_connected", platform })
    if (!Number.isFinite(at) || at < now - 5 * 60_000 || at > now + 120 * 86400_000) return fail(req, "Время публикации — от «сейчас» до 120 дней вперёд")
    const v = await pool.query(`SELECT id FROM studio_videos WHERE id = $1 AND user_id = $2 AND url <> '' AND deleted_at IS NULL`, [videoId, u.id])
    if (!v.rows[0]) return fail(req, "Ролик не загружен", 400)
    const privacy = platform === "tiktok" ? (TT_PRIVACY.includes(it.privacy) ? it.privacy : "PUBLIC_TO_EVERYONE") : platform === "youtube" ? (YT_PRIVACY.includes(it.privacy) ? it.privacy : "public") : null
    rows.push([u.id, videoId, platform, String(it.title || "").slice(0, 100) || null, String(it.caption || "").slice(0, 2200), privacy, new Date(Math.max(at, now)).toISOString()])
  }
  const ids: string[] = []
  for (const r of rows) {
    const x = await pool.query(`INSERT INTO studio_posts (user_id, video_id, platform, title, caption, privacy, scheduled_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, r)
    ids.push(String(x.rows[0].id))
  }
  // то, что «прямо сейчас», не ждёт расписания; YouTube с выходом позже загружаем сразу — он сам выпустит ролик в назначенное время
  if (rows.some((r) => new Date(r[6]).getTime() <= Date.now() + 30_000 || (r[2] === "youtube" && r[5] === "public"))) await processDue({ userId: u.id, limit: 2, budgetMs: 20_000 }).catch((e) => console.error(e))
  return json(req, { ok: true, ids })
})
