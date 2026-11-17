import { pool } from "@/lib/db"
import { authed, fail, json, preflight, siteUrl } from "@/lib/studio/core"
import { storageMode } from "@/lib/studio/storage"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

/**
 * { action: "create", size, duration, mime, title } → номер ролика и куда грузить файл;
 * { action: "finish", id, url } → студия сообщает адрес загруженного файла (Vercel Blob).
 */
export const POST = authed(async (req, u) => {
  const b = await req.json().catch(() => ({})) as any
  const mode = storageMode()
  if (!mode) return fail(req, "Хранилище роликов ещё не подключено к сайту", 503, { code: "no_storage" })
  if (b.action === "create") {
    const size = Number(b.size), duration = Number(b.duration) || null, mime = String(b.mime || "video/mp4").split(";")[0]
    if (!(size > 0 && size <= 300 * 1048576)) return fail(req, "Неверный размер файла")
    if (!["video/mp4", "video/webm"].includes(mime)) return fail(req, "Нужен mp4 или webm")
    const busy = await pool.query(`SELECT count(*)::int AS n FROM studio_videos WHERE user_id = $1 AND deleted_at IS NULL`, [u.id])
    if (busy.rows[0].n >= 60) return fail(req, "В очереди уже 60 роликов — дождись публикации или отмени часть", 429)
    await pool.query(`DELETE FROM studio_videos WHERE user_id = $1 AND url = '' AND created_at < now() - interval '1 hour'`, [u.id])
    const r = await pool.query(`INSERT INTO studio_videos (user_id, url, size, duration, mime, title) VALUES ($1, '', $2, $3, $4, $5) RETURNING id`,
      [u.id, size, duration, mime, String(b.title || "").slice(0, 200) || null])
    const id = r.rows[0].id, ext = mime === "video/webm" ? "webm" : "mp4", name = `${id}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    return json(req, { id: String(id), mode, ...(mode === "local" ? { putUrl: `${siteUrl(req)}/api/studio/local-blob/${name}` } : { pathname: `studio/${u.id}/${name}`, handleUploadUrl: `${siteUrl(req)}/api/studio/blob` }) })
  }
  if (b.action === "finish") {
    const id = Number(b.id), url = String(b.url || "")
    const okUrl = mode === "local" ? url.includes("/api/studio/local-blob/" + id + "-") : /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/studio\//.test(url)
    if (!okUrl) return fail(req, "Неверный адрес файла")
    const r = await pool.query(`UPDATE studio_videos SET url = $1 WHERE id = $2 AND user_id = $3 AND (url = '' OR url = $1) RETURNING id`, [url, id, u.id])
    if (!r.rows[0]) return fail(req, "Ролик не найден", 404)
    return json(req, { ok: true })
  }
  return fail(req, "Неизвестное действие")
})
