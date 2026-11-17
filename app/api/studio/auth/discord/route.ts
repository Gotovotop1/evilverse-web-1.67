import { backToStudio, handler, preflight, signState, siteUrl } from "@/lib/studio/core"
import { discord } from "@/lib/studio/platforms"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

/** Вход в студию через Discord: уводим на страницу Discord, ответ придёт в /oauth/discord/callback. */
export const GET = handler(async (req) => {
  if (!discord.configured()) return backToStudio({ auth_error: "Вход через Discord ещё не настроен" })
  const redirect = `${siteUrl(req)}/api/studio/oauth/discord/callback`
  return Response.redirect(discord.authUrl(signState({ p: "login" }), redirect), 302)
})
