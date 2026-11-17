import { createHmac, timingSafeEqual } from "node:crypto"
import { pool } from "@/lib/db"
import { env, handler, randomToken, STUDIO_URL } from "@/lib/studio/core"

export const dynamic = "force-dynamic"

/**
 * Обязательные для проверки Meta адреса: «отзыв доступа» и «удаление данных».
 * Meta присылает signed_request; удаляем подключение Instagram этого пользователя.
 */
function parseSigned(sr: string | null) {
  if (!sr) return null
  const [sig, payload] = sr.split(".")
  if (!sig || !payload) return null
  const want = createHmac("sha256", env("INSTAGRAM_APP_SECRET")).update(payload).digest("base64url")
  const a = Buffer.from(sig), b = Buffer.from(want)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try { return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) } catch { return null }
}
export const POST = handler(async (req) => {
  const f = await req.formData().catch(() => null)
  const data = parseSigned(f ? String(f.get("signed_request") ?? "") : null)
  if (!data?.user_id) return new Response(JSON.stringify({ error: "bad signed_request" }), { status: 400 })
  await pool.query(`DELETE FROM studio_social WHERE platform = 'instagram' AND account_id = $1`, [String(data.user_id)])
  const code = randomToken(8)
  return new Response(JSON.stringify({ url: `${STUDIO_URL()}/privacy.html#deletion`, confirmation_code: code }), { headers: { "Content-Type": "application/json" } })
})
