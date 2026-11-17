import { pool } from "@/lib/db"
import { authed, fail, json, preflight } from "@/lib/studio/core"
import { processDue } from "@/lib/studio/worker"

export const dynamic = "force-dynamic"
export const maxDuration = 60
export const OPTIONS = preflight

/** { action: "cancel" } — отменить; { action: "now" } — выложить сейчас; { action: "move", at } — перенести; { action: "retry" } — повторить неудачную. */
export const PATCH = authed(async (req, u, ctx) => {
  const { id } = await ctx.params
  const b = await req.json().catch(() => ({})) as { action?: string; at?: string; caption?: string }
  const p = (await pool.query(`SELECT * FROM studio_posts WHERE id = $1 AND user_id = $2`, [Number(id), u.id])).rows[0]
  if (!p) return fail(req, "Публикация не найдена", 404)
  if (b.action === "cancel") {
    if (p.status !== "scheduled") return fail(req, "Отменить можно только запланированную публикацию")
    await pool.query(`UPDATE studio_posts SET status = 'cancelled', updated_at = now() WHERE id = $1`, [p.id])
  } else if (b.action === "now" || b.action === "retry") {
    if (!(p.status === "scheduled" || (b.action === "retry" && (p.status === "failed" || p.status === "cancelled")))) return fail(req, "Эту публикацию нельзя выложить сейчас")
    await pool.query(`UPDATE studio_posts SET status = 'scheduled', scheduled_at = now(), attempts = 0, error = NULL, locked_at = NULL, updated_at = now() WHERE id = $1`, [p.id])
    await processDue({ userId: u.id, limit: 2, budgetMs: 40_000 }).catch((e) => console.error(e))
  } else if (b.action === "move") {
    const at = new Date(String(b.at)).getTime()
    if (p.status !== "scheduled" || !Number.isFinite(at) || at < Date.now() - 60_000 || at > Date.now() + 120 * 86400_000) return fail(req, "Неверное время")
    await pool.query(`UPDATE studio_posts SET scheduled_at = $2, updated_at = now() WHERE id = $1`, [p.id, new Date(at).toISOString()])
  } else if (b.action === "caption") {
    if (p.status !== "scheduled") return fail(req, "Описание меняется только до публикации")
    await pool.query(`UPDATE studio_posts SET caption = $2, updated_at = now() WHERE id = $1`, [p.id, String(b.caption ?? "").slice(0, 2200)])
  } else return fail(req, "Неизвестное действие")
  const r = (await pool.query(`SELECT id, status, scheduled_at, remote_url, error FROM studio_posts WHERE id = $1`, [p.id])).rows[0]
  return json(req, { ok: true, post: { ...r, id: String(r.id) } })
})
