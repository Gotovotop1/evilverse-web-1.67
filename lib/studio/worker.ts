/*
 * EvilVerse Studio — обработчик расписания публикаций.
 * © 2026 EvilVerse (evilverse.lol). Все права защищены.
 *
 * Статусы публикации: scheduled → (время пришло) → processing (платформа обрабатывает) → published
 *                     ошибка: временная → снова scheduled позже (до 5 попыток); постоянная → failed; отмена → cancelled
 */
import { pool } from "@/lib/db"
import { env, seal, unseal } from "./core"
import { PLATFORMS, PlatformError, isPlatform, type PostRow, type VideoRow } from "./platforms"

const MAX_ATTEMPTS = 5

/** Свежий ключ доступа к соцсети (продлевает сам, если скоро истечёт). */
export async function accessFor(social: any): Promise<string> {
  const p = social.platform
  const exp = social.expires_at ? new Date(social.expires_at).getTime() : 0
  const access = unseal(social.access_enc)!
  if (p === "instagram") {
    // долгий ключ живёт 60 дней: продлеваем, если осталось меньше 20 дней
    if (exp && exp - Date.now() > 20 * 86400_000) return access
    try { const t = await PLATFORMS.instagram.refresh(access); await saveTokens(social.id, t.access, null, t.expiresIn); return t.access }
    catch (e) { if (exp > Date.now()) return access; throw e }
  }
  if (exp - Date.now() > 5 * 60_000) return access
  const refresh = unseal(social.refresh_enc)
  if (!refresh) throw new PlatformError("доступ истёк, подключи аккаунт заново", false, 0, true)
  const t = p === "tiktok" ? await PLATFORMS.tiktok.refresh(refresh) : await PLATFORMS.youtube.refresh(refresh)
  await saveTokens(social.id, t.access, t.refresh ?? refresh, t.expiresIn, t.refreshExpiresIn)
  return t.access
}
async function saveTokens(id: number, access: string, refresh: string | null, expiresIn?: number | null, refreshExpiresIn?: number | null) {
  await pool.query(
    `UPDATE studio_social SET access_enc = $2, refresh_enc = COALESCE($3, refresh_enc), expires_at = now() + make_interval(secs => $4),
       refresh_expires_at = CASE WHEN $5::int IS NULL THEN refresh_expires_at ELSE now() + make_interval(secs => $5) END, updated_at = now() WHERE id = $1`,
    [id, seal(access), refresh ? seal(refresh) : null, expiresIn ?? 3600, refreshExpiresIn ?? null])
}

async function finish(id: number, status: string, fields: Record<string, unknown> = {}) {
  const cols = ["status = $2", "locked_at = NULL", "updated_at = now()"], vals: unknown[] = [id, status]
  for (const [k, v] of Object.entries(fields)) { vals.push(v); cols.push(`${k} = $${vals.length}`) }
  await pool.query(`UPDATE studio_posts SET ${cols.join(", ")} WHERE id = $1`, vals)
}

/** Одна публикация: выложить или проверить, как дела у уже отправленной. */
export async function runPost(post: any) {
  const plat = post.platform
  try {
    if (!isPlatform(plat)) throw new PlatformError("неизвестная платформа " + plat)
    const v = (await pool.query(`SELECT * FROM studio_videos WHERE id = $1`, [post.video_id])).rows[0] as VideoRow & { deleted_at: string | null }
    if (!v || v.deleted_at) throw new PlatformError("файл ролика уже удалён из хранилища")
    const social = (await pool.query(`SELECT * FROM studio_social WHERE user_id = $1 AND platform = $2`, [post.user_id, plat])).rows[0]
    if (!social) throw new PlatformError("соцсеть отключена от студии")
    const access = await accessFor(social)
    const P = post as PostRow
    let res
    if (post.status === "processing") {
      res = plat === "tiktok" ? await PLATFORMS.tiktok.poll(P, access) : plat === "instagram" ? await PLATFORMS.instagram.poll(P, access, social.account_id) : { state: "published" as const, remoteId: post.remote_id }
      if (!res) {
        // ещё обрабатывается: проверим снова через пару минут, но не дольше 3 часов
        if (Date.now() - new Date(post.updated_at).getTime() > 3 * 3600_000 && Date.now() - new Date(post.scheduled_at).getTime() > 3 * 3600_000) throw new PlatformError("платформа слишком долго обрабатывает ролик")
        await finish(post.id, "processing", { scheduled_at: new Date(Date.now() + 90_000).toISOString() })
        return "processing"
      }
    } else {
      res = plat === "tiktok" ? await PLATFORMS.tiktok.publish(P, v, access) : plat === "youtube" ? await PLATFORMS.youtube.publish(P, v, access) : await PLATFORMS.instagram.publish(P, v, access, social.account_id)
    }
    if (res.state === "processing") {
      await finish(post.id, "processing", { remote_id: res.remoteId ?? post.remote_id, error: res.note ?? null, scheduled_at: new Date(Date.now() + 60_000).toISOString() })
      return "processing"
    }
    await finish(post.id, "published", { remote_id: res.remoteId ?? post.remote_id, remote_url: res.remoteUrl ?? null, error: res.note ?? null })
    return "published"
  } catch (e: any) {
    const pe = e instanceof PlatformError ? e : new PlatformError(String(e?.message || e), true)
    const attempts = (post.attempts ?? 0) + 1
    if (pe.retry && attempts < MAX_ATTEMPTS && post.status !== "processing") {
      await finish(post.id, "scheduled", { attempts, error: pe.message + ` (попытка ${attempts} из ${MAX_ATTEMPTS})`, scheduled_at: new Date(Date.now() + pe.retryAfterMin * 60_000).toISOString() })
      return "retry"
    }
    if (pe.retry && post.status === "processing" && attempts < MAX_ATTEMPTS * 4) {
      await finish(post.id, "processing", { attempts, scheduled_at: new Date(Date.now() + 3 * 60_000).toISOString() })
      return "retry"
    }
    await finish(post.id, "failed", { attempts, error: pe.message })
    if (pe.reconnect) await pool.query(`UPDATE studio_social SET broken = $3, updated_at = now() WHERE user_id = $1 AND platform = $2`, [post.user_id, plat, pe.message])
    return "failed"
  }
}

/** Забирает подошедшие публикации (без двойной обработки при параллельных запусках) и выкладывает их. */
export async function processDue(opts: { limit?: number; userId?: number | string | null; budgetMs?: number } = {}) {
  const started = Date.now(), budget = opts.budgetMs ?? 45_000, out: Record<string, number> = {}
  for (let round = 0; round < 20 && Date.now() - started < budget; round++) {
    const r = await pool.query(
      `UPDATE studio_posts SET locked_at = now() WHERE id IN (
         SELECT id FROM studio_posts WHERE status IN ('scheduled','processing') AND scheduled_at <= now()
           AND (locked_at IS NULL OR locked_at < now() - interval '10 minutes') ${opts.userId ? "AND user_id = $2" : ""}
         ORDER BY scheduled_at LIMIT $1 FOR UPDATE SKIP LOCKED) RETURNING *`,
      opts.userId ? [1, opts.userId] : [1])
    const post = r.rows[0]
    if (!post) break
    const st = await runPost(post)
    out[st] = (out[st] ?? 0) + 1
    if (opts.limit && Object.values(out).reduce((a, b) => a + b, 0) >= opts.limit) break
  }
  await cleanup().catch((e) => console.error("studio cleanup", e))
  return out
}

/** Удаляет из хранилища ролики, по которым все публикации завершены больше суток назад. */
export async function cleanup() {
  const r = await pool.query(
    `SELECT v.id, v.url FROM studio_videos v WHERE v.deleted_at IS NULL AND v.created_at < now() - interval '1 day'
       AND NOT EXISTS (SELECT 1 FROM studio_posts p WHERE p.video_id = v.id AND (p.status IN ('scheduled','processing') OR p.updated_at > now() - interval '1 day'))
     LIMIT 20`)
  for (const v of r.rows) {
    await deleteStored(v.url).catch(() => {})
    await pool.query(`UPDATE studio_videos SET deleted_at = now() WHERE id = $1`, [v.id])
  }
  return r.rows.length
}
export async function deleteStored(url: string) {
  if (/\.blob\.vercel-storage\.com\//.test(url) && (env("BLOB_READ_WRITE_TOKEN") || env("BLOB_STORE_ID"))) { const { del } = await import("@vercel/blob"); await del(url) }
  else if (url.includes("/api/studio/local-blob/")) { const { localDelete } = await import("./storage"); await localDelete(url) }
}
