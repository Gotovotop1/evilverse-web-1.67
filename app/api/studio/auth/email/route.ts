import { randomInt } from "node:crypto"
import { pool } from "@/lib/db"
import { createSession, env, fail, handler, json, preflight, sha, upsertUser } from "@/lib/studio/core"
import { clientIp, rateLimitedShared } from "@/lib/server-utils"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i
const devCodes = () => env("STUDIO_DEV_LOGIN_CODES") === "1" && process.env.VERCEL_ENV !== "production"

/** Вход по коду на почту: { action: "start", email } → письмо с кодом; { action: "verify", email, code } → сессия. */
export const POST = handler(async (req) => {
  const body = await req.json().catch(() => ({})) as { action?: string; email?: string; code?: string }
  const email = String(body.email ?? "").trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return fail(req, "Проверь адрес почты")
  if (body.action === "start") {
    if (!(env("RESEND_API_KEY") && env("STUDIO_MAIL_FROM")) && !devCodes()) return fail(req, "Вход по почте ещё не настроен", 503)
    if (await rateLimitedShared("studio-mail:" + email, 3, 10 * 60_000) || await rateLimitedShared("studio-mail-ip:" + clientIp(req), 10, 60 * 60_000))
      return fail(req, "Слишком много писем. Подожди 10 минут", 429)
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
    await pool.query(`INSERT INTO studio_login_codes (email, code_hash, attempts, expires_at) VALUES ($1, $2, 0, now() + interval '10 minutes')
      ON CONFLICT (email) DO UPDATE SET code_hash = $2, attempts = 0, expires_at = now() + interval '10 minutes'`, [email, sha(email + ":" + code)])
    if (env("RESEND_API_KEY")) {
      const r = await fetch((env("RESEND_API_URL") || "https://api.resend.com") + "/emails", {
        method: "POST", headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env("STUDIO_MAIL_FROM"), to: [email], subject: `Код входа в EvilVerse Studio: ${code}`,
          html: `<div style="font-family:Arial,sans-serif;background:#140706;color:#ffe9c7;padding:28px;border-radius:12px;max-width:420px">
            <h2 style="margin:0 0 12px;color:#ff6a00">EvilVerse Studio</h2><p>Твой код входа:</p>
            <p style="font-size:34px;letter-spacing:8px;font-weight:bold;margin:8px 0 16px;color:#fff">${code}</p>
            <p style="color:#c9a58b;font-size:13px">Код действует 10 минут. Если это был не ты — просто удали письмо.</p></div>`,
          text: `Код входа в EvilVerse Studio: ${code}. Действует 10 минут.` }) })
      if (!r.ok) return fail(req, "Письмо не отправилось, попробуй позже", 502)
    }
    return json(req, { ok: true, ...(devCodes() ? { devCode: code } : {}) })
  }
  if (body.action === "verify") {
    const code = String(body.code ?? "").replace(/\D/g, "")
    const r = await pool.query(`UPDATE studio_login_codes SET attempts = attempts + 1 WHERE email = $1 AND expires_at > now() RETURNING code_hash, attempts`, [email])
    const row = r.rows[0]
    if (!row) return fail(req, "Код устарел. Запроси новый", 400)
    if (row.attempts > 5) return fail(req, "Слишком много попыток. Запроси новый код", 429)
    if (row.code_hash !== sha(email + ":" + code)) return fail(req, "Неверный код", 400)
    await pool.query(`DELETE FROM studio_login_codes WHERE email = $1`, [email])
    const u = await upsertUser("email", email)
    return json(req, { token: await createSession(u.id) })
  }
  return fail(req, "Неизвестное действие")
})
