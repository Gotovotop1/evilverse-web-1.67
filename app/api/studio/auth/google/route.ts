import { backToStudio, handler, preflight, signState, siteUrl } from "@/lib/studio/core"
import { google } from "@/lib/studio/platforms"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

/** Вход в студию через Google: уводим на страницу Google, ответ придёт в /oauth/google/callback. */
export const GET = handler(async (req) => {
  if (!google.configured()) return backToStudio({ auth_error: "Вход через Google ещё не настроен" })
  const redirect = `${siteUrl(req)}/api/studio/oauth/google/callback`
  return Response.redirect(google.authUrl(signState({ p: "login" }), redirect, "login"), 302)
})
