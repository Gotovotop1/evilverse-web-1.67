import { pool } from "@/lib/db"
import { fail, handler, json, preflight, userFromRequest } from "@/lib/studio/core"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

/**
 * Загрузка ролика в Vercel Blob прямо из браузера (файл не проходит через функцию сайта).
 * 1) студия просит токен (нужна сессия, в clientPayload — номер ролика), 2) Vercel Blob сообщает о готовности.
 */
export const POST = handler(async (req) => {
  const { handleUpload } = await import("@vercel/blob/client")
  const body = await req.json()
  let user: any = null
  if (body?.type === "blob.generate-client-token") {
    user = await userFromRequest(req)
    if (!user) return fail(req, "Нужно войти в аккаунт студии", 401)
  }
  try {
    const out = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const id = Number(clientPayload)
        const v = await pool.query(`SELECT id FROM studio_videos WHERE id = $1 AND user_id = $2 AND url = ''`, [id, user.id])
        if (!v.rows[0] || !pathname.startsWith(`studio/${user.id}/`)) throw new Error("Ролик не найден")
        return { allowedContentTypes: ["video/mp4", "video/webm"], maximumSizeInBytes: 300 * 1048576, addRandomSuffix: true, tokenPayload: JSON.stringify({ id, user: user.id }) }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const p = JSON.parse(tokenPayload || "{}")
        await pool.query(`UPDATE studio_videos SET url = $1 WHERE id = $2 AND user_id = $3 AND url = ''`, [blob.url, p.id, p.user])
      },
    })
    return json(req, out)
  } catch (e: any) { return fail(req, e?.message || "Загрузка не разрешена", 400) }
})
