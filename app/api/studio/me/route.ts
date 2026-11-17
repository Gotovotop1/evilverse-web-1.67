import { pool } from "@/lib/db"
import { authed, json, preflight } from "@/lib/studio/core"
import { deleteStored } from "@/lib/studio/worker"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

/** Профиль: кто вошёл и какие соцсети подключены (без ключей доступа). */
export const GET = authed(async (req, u) => {
  const s = await pool.query(`SELECT platform, name, avatar, broken, created_at FROM studio_social WHERE user_id = $1`, [u.id])
  const socials = Object.fromEntries(s.rows.map((r) => [r.platform, { name: r.name, avatar: r.avatar, since: r.created_at, needsReconnect: !!r.broken, problem: r.broken }]))
  const c = await pool.query(`SELECT status, count(*)::int AS n FROM studio_posts WHERE user_id = $1 GROUP BY status`, [u.id])
  return json(req, { user: { id: String(u.id), name: u.name, email: u.email, avatar: u.avatar, telegram: !!u.telegram_id, google: !!u.google_sub, discord: !!u.discord_id }, socials, counts: Object.fromEntries(c.rows.map((r) => [r.status, r.n])) })
})

/** Удалить аккаунт студии целиком: соцсети, ролики, публикации, сессии. */
export const DELETE = authed(async (req, u) => {
  const v = await pool.query(`SELECT url FROM studio_videos WHERE user_id = $1 AND deleted_at IS NULL`, [u.id])
  for (const x of v.rows) await deleteStored(x.url).catch(() => {})
  await pool.query(`DELETE FROM studio_users WHERE id = $1`, [u.id])
  return json(req, { ok: true })
})
