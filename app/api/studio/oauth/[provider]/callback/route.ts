import { pool } from "@/lib/db"
import { backToStudio, createSession, handler, readState, seal, siteUrl, upsertUser } from "@/lib/studio/core"
import { PLATFORMS, PlatformError } from "@/lib/studio/platforms"

export const dynamic = "force-dynamic"

/** Ответ платформы после входа или подключения соцсети. */
export const GET = handler(async (req, ctx) => {
  const { provider } = await ctx.params
  const q = new URL(req.url).searchParams
  const st = readState(q.get("state"))
  if (!st) return backToStudio({ connect_error: "Сессия подключения устарела, попробуй ещё раз" })
  if (q.get("error")) return backToStudio({ [st.p === "login" ? "auth_error" : "connect_error"]: q.get("error") === "access_denied" ? "Ты отменил доступ" : "Платформа вернула ошибку: " + (q.get("error_description") || q.get("error")) })
  const code = q.get("code")
  if (!code) return backToStudio({ connect_error: "Платформа не вернула код доступа" })
  const redirect = `${siteUrl(req)}/api/studio/oauth/${provider}/callback`
  try {
    if (provider === "google" && st.p === "login") {
      const t = await PLATFORMS.youtube.exchange(code, redirect)
      const u = await upsertUser("google_sub", t.idUser.id, { email: t.idUser.email, name: t.idUser.name, avatar: t.idUser.avatar })
      return backToStudio({ signed_in: "google" }, { evs_token: await createSession(u.id) })
    }
    const userId = st.u
    if (!userId) return backToStudio({ connect_error: "Сначала войди в студию" })
    let tok, account
    if (provider === "google" && st.p === "youtube") {
      const t = await PLATFORMS.youtube.exchange(code, redirect)
      if (!String(t.scopes ?? "").includes("youtube.upload")) throw new PlatformError("не дано разрешение на загрузку видео — подключи YouTube ещё раз и отметь все галочки")
      tok = t; account = await PLATFORMS.youtube.channel(t.access)
    } else if (provider === "tiktok" && st.p === "tiktok") { const t = await PLATFORMS.tiktok.exchange(code, redirect); tok = t; account = t.account }
    else if (provider === "instagram" && st.p === "instagram") { const t = await PLATFORMS.instagram.exchange(code, redirect); tok = t; account = t.account }
    else return backToStudio({ connect_error: "Неверный ответ платформы" })
    await pool.query(
      `INSERT INTO studio_social (user_id, platform, account_id, name, avatar, access_enc, refresh_enc, expires_at, refresh_expires_at, scopes, broken)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(secs => $8), CASE WHEN $9::int IS NULL THEN NULL ELSE now() + make_interval(secs => $9) END, $10, NULL)
       ON CONFLICT (user_id, platform) DO UPDATE SET account_id = $3, name = $4, avatar = $5, access_enc = $6, refresh_enc = COALESCE($7, studio_social.refresh_enc),
         expires_at = now() + make_interval(secs => $8), refresh_expires_at = CASE WHEN $9::int IS NULL THEN studio_social.refresh_expires_at ELSE now() + make_interval(secs => $9) END,
         scopes = $10, broken = NULL, updated_at = now()`,
      [userId, st.p, account.id, account.name ?? null, account.avatar ?? null, seal(tok.access), seal(tok.refresh ?? null), tok.expiresIn ?? 3600, tok.refreshExpiresIn ?? null, tok.scopes ?? null])
    return backToStudio({ connected: st.p })
  } catch (e: any) {
    console.error("studio oauth", provider, e)
    return backToStudio({ [st.p === "login" ? "auth_error" : "connect_error"]: (e?.message || "не получилось").slice(0, 200) })
  }
})
