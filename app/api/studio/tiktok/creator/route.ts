import { pool } from "@/lib/db"
import { authed, fail, json, preflight } from "@/lib/studio/core"
import { PLATFORMS, PlatformError } from "@/lib/studio/platforms"
import { accessFor } from "@/lib/studio/worker"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

/** Настройки автора TikTok: какие варианты приватности разрешены и максимальная длина ролика (TikTok требует показать это перед публикацией). */
export const GET = authed(async (req, u) => {
  const s = (await pool.query(`SELECT * FROM studio_social WHERE user_id = $1 AND platform = 'tiktok'`, [u.id])).rows[0]
  if (!s) return fail(req, "TikTok не подключён", 404)
  try { return json(req, await PLATFORMS.tiktok.creatorInfo(await accessFor(s))) }
  catch (e: any) { return fail(req, e instanceof PlatformError ? e.message : "TikTok не ответил", 502) }
})
