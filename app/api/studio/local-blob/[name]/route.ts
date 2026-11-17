import { pool } from "@/lib/db"
import { authed, fail, handler, json, preflight, siteUrl } from "@/lib/studio/core"
import { localRead, localSave, storageMode } from "@/lib/studio/storage"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

// Только для проверки на своём компьютере (STUDIO_STORAGE=local): файл ролика лежит на диске.
export const PUT = authed(async (req, u, ctx) => {
  if (storageMode() !== "local") return fail(req, "Локальное хранилище выключено", 404)
  const { name } = await ctx.params
  const id = Number(String(name).split("-")[0])
  const v = await pool.query(`SELECT id FROM studio_videos WHERE id = $1 AND user_id = $2 AND url = ''`, [id, u.id])
  if (!v.rows[0]) return fail(req, "Ролик не найден", 404)
  const data = new Uint8Array(await req.arrayBuffer())
  if (data.length > 300 * 1048576) return fail(req, "Файл слишком большой", 413)
  await localSave(name, data)
  const url = `${siteUrl(req)}/api/studio/local-blob/${name}`
  await pool.query(`UPDATE studio_videos SET url = $1 WHERE id = $2`, [url, id])
  return json(req, { url })
})
export const GET = handler(async (req, ctx) => {
  if (storageMode() !== "local") return new Response("not found", { status: 404 })
  const { name } = await ctx.params
  try { const d = await localRead(name); return new Response(d, { headers: { "Content-Type": name.endsWith(".webm") ? "video/webm" : "video/mp4", "Content-Length": String(d.length) } }) }
  catch { return new Response("not found", { status: 404 }) }
})
