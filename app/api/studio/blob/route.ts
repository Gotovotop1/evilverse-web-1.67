import { pool } from "@/lib/db"
import { env, fail, handler, json, preflight, userFromRequest } from "@/lib/studio/core"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

const TYPES = ["video/mp4", "video/webm"], MAX = 300 * 1048576

/**
 * Загрузка ролика в Vercel Blob прямо из браузера (файл не проходит через функцию сайта).
 *  - новые хранилища (BLOB_STORE_ID, без постоянного ключа): presigned-ссылка, подписанная через OIDC Vercel;
 *  - старые (BLOB_READ_WRITE_TOKEN): клиентский токен.
 * 1) студия просит ссылку/токен (нужна сессия, в clientPayload — номер ролика); 2) Vercel Blob сообщает о готовности.
 */
export const POST = handler(async (req) => {
  const client = await import("@vercel/blob/client")
  const body = await req.json()
  let user: any = null
  if (body?.type === "blob.generate-client-token" || body?.type === "blob.generate-presigned-url") {
    user = await userFromRequest(req)
    if (!user) return fail(req, "Нужно войти в аккаунт студии", 401)
  }
  const check = async (pathname: string, clientPayload: string | null) => {
    const id = Number(clientPayload)
    const v = await pool.query(`SELECT id FROM studio_videos WHERE id = $1 AND user_id = $2 AND url = ''`, [id, user.id])
    if (!v.rows[0] || !pathname.startsWith(`studio/${user.id}/${id}-`)) throw new Error("Ролик не найден")
    return id
  }
  const onUploadCompleted = async ({ blob, tokenPayload }: any) => {
    const p = JSON.parse(tokenPayload || "{}")
    if (p.id && p.user) await pool.query(`UPDATE studio_videos SET url = $1 WHERE id = $2 AND user_id = $3 AND url = ''`, [blob.url, p.id, p.user])
  }
  try {
    const presigned = body?.type === "blob.generate-presigned-url" || (body?.type === "blob.upload-completed" && !!env("BLOB_WEBHOOK_PUBLIC_KEY") && !env("BLOB_READ_WRITE_TOKEN"))
    if (presigned) {
      const { issueSignedToken } = await import("@vercel/blob")
      const out = await client.handleUploadPresigned({
        body, request: req, onUploadCompleted,
        getSignedToken: async (pathname, clientPayload) => {
          const id = await check(pathname, clientPayload)
          const token = await issueSignedToken({ pathname, operations: ["put"], allowedContentTypes: TYPES, maximumSizeInBytes: MAX, validUntil: Date.now() + 60 * 60_000 })
          return { token, urlOptions: { allowedContentTypes: TYPES, maximumSizeInBytes: MAX, addRandomSuffix: false, tokenPayload: JSON.stringify({ id, user: user.id }) } }
        },
      })
      return json(req, out)
    }
    const out = await client.handleUpload({
      body, request: req, onUploadCompleted,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const id = await check(pathname, clientPayload)
        return { allowedContentTypes: TYPES, maximumSizeInBytes: MAX, addRandomSuffix: false, tokenPayload: JSON.stringify({ id, user: user.id }) }
      },
    })
    return json(req, out)
  } catch (e: any) { return fail(req, e?.message || "Загрузка не разрешена", 400) }
})
