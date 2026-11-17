import { pool } from "@/lib/db"
import { authed, backToStudio, handler, json, preflight, signState, siteUrl, useTicket } from "@/lib/studio/core"
import { PLATFORMS, isPlatform } from "@/lib/studio/platforms"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

const NAMES = { tiktok: "TikTok", youtube: "YouTube", instagram: "Instagram" }

/** Подключить соцсеть: студия открывает этот адрес с одноразовым билетом, дальше — страница платформы. */
export const GET = handler(async (req, ctx) => {
  const { platform } = await ctx.params
  if (!isPlatform(platform)) return backToStudio({ connect_error: "Неизвестная соцсеть" })
  if (!PLATFORMS[platform].configured()) return backToStudio({ connect_error: `${NAMES[platform]} ещё не подключён к студии` })
  const userId = await useTicket(new URL(req.url).searchParams.get("ticket"))
  if (!userId) return backToStudio({ connect_error: "Ссылка устарела. Нажми «Подключить» ещё раз" })
  const provider = platform === "youtube" ? "google" : platform
  const redirect = `${siteUrl(req)}/api/studio/oauth/${provider}/callback`
  const state = signState({ p: platform, u: String(userId) })
  const url = platform === "youtube" ? PLATFORMS.youtube.authUrl(state, redirect, "youtube")
    : platform === "tiktok" ? PLATFORMS.tiktok.authUrl(state, redirect) : PLATFORMS.instagram.authUrl(state, redirect)
  return Response.redirect(url, 302)
})

/** Отключить соцсеть: ключи доступа удаляются, запланированные публикации в неё отменяются. */
export const DELETE = authed(async (req, u, ctx) => {
  const { platform } = await ctx.params
  if (!isPlatform(platform)) return json(req, { error: "Неизвестная соцсеть" }, 400)
  await pool.query(`DELETE FROM studio_social WHERE user_id = $1 AND platform = $2`, [u.id, platform])
  const c = await pool.query(`UPDATE studio_posts SET status = 'cancelled', error = 'соцсеть отключена', updated_at = now() WHERE user_id = $1 AND platform = $2 AND status = 'scheduled'`, [u.id, platform])
  return json(req, { ok: true, cancelled: c.rowCount })
})
