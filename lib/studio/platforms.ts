/*
 * EvilVerse Studio — подключение соцсетей и публикация через официальные API.
 * © 2026 EvilVerse (evilverse.lol). Все права защищены.
 *
 *   TikTok     — Login Kit + Content Posting API (Direct Post, загрузка файла с сервера)
 *   YouTube    — Google OAuth + YouTube Data API v3 (resumable upload, Shorts)
 *   Instagram  — Instagram API with Instagram Login (Reels через контейнер и media_publish)
 *   Discord    — только вход в студию (OAuth2, scopes identify email)
 *
 * Все адреса можно переопределить переменными окружения (нужно для тестового стенда).
 */
import { env } from "./core"

export type Tokens = { access: string; refresh?: string | null; expiresIn?: number | null; refreshExpiresIn?: number | null; scopes?: string | null }
export type Account = { id: string; name?: string | null; avatar?: string | null; email?: string | null }
export type PostRow = { id: number; platform: string; title: string | null; caption: string; privacy: string | null; remote_id: string | null; scheduled_at: string }
export type VideoRow = { id: number; url: string; size: number; duration: number | null; mime: string | null }
export type PublishResult = { state: "published" | "processing"; remoteId?: string | null; remoteUrl?: string | null; note?: string | null }

export class PlatformError extends Error {
  constructor(message: string, public retry = false, public retryAfterMin = 15, public reconnect = false) { super(message) }
}

const base = (k: string, d: string) => (env(k) || d).replace(/\/$/, "")
const form = (o: Record<string, string>) => new URLSearchParams(o).toString()
async function readJson(r: Response) { const t = await r.text(); try { return JSON.parse(t) } catch { return { raw: t.slice(0, 300) } } }
async function fetchVideo(v: VideoRow) {
  const r = await fetch(v.url)
  if (!r.ok) throw new PlatformError(`ролик не скачался из хранилища (${r.status})`, true)
  return new Uint8Array(await r.arrayBuffer())
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// =====================================================================================
// Google: вход в студию и YouTube Shorts
// =====================================================================================
const G_AUTH = () => base("GOOGLE_AUTH_URL", "https://accounts.google.com/o/oauth2/v2/auth")
const G_TOKEN = () => base("GOOGLE_TOKEN_URL", "https://oauth2.googleapis.com/token")
const G_API = () => base("GOOGLE_API_BASE", "https://www.googleapis.com")
const YT_SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly"

export const google = {
  configured: () => !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")),
  authUrl(state: string, redirectUri: string, purpose: "login" | "youtube") {
    const p = new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"), redirect_uri: redirectUri, response_type: "code", state,
      scope: purpose === "login" ? "openid email profile" : "openid email " + YT_SCOPES,
      include_granted_scopes: "true",
      ...(purpose === "youtube" ? { access_type: "offline", prompt: "consent" } : { prompt: "select_account" }),
    })
    return `${G_AUTH()}?${p}`
  },
  async exchange(code: string, redirectUri: string): Promise<Tokens & { idUser: Account }> {
    const r = await fetch(G_TOKEN(), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ code, client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), redirect_uri: redirectUri, grant_type: "authorization_code" }) })
    const j = await readJson(r)
    if (!r.ok || !j.access_token) throw new PlatformError("Google не выдал доступ: " + (j.error_description || j.error || r.status))
    const u = await readJson(await fetch(`${G_API()}/oauth2/v3/userinfo`, { headers: { Authorization: `Bearer ${j.access_token}` } }))
    if (!u.sub) throw new PlatformError("Google не вернул профиль")
    return { access: j.access_token, refresh: j.refresh_token ?? null, expiresIn: j.expires_in ?? 3600, scopes: j.scope ?? null,
      idUser: { id: String(u.sub), name: u.name ?? null, avatar: u.picture ?? null, email: u.email_verified === false ? null : u.email ?? null } }
  },
  async refresh(refresh: string): Promise<Tokens> {
    const r = await fetch(G_TOKEN(), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ refresh_token: refresh, client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), grant_type: "refresh_token" }) })
    const j = await readJson(r)
    if (!r.ok || !j.access_token) throw new PlatformError("доступ к YouTube отозван, подключи канал заново", false, 0, true)
    return { access: j.access_token, refresh: j.refresh_token ?? refresh, expiresIn: j.expires_in ?? 3600 }
  },
  async channel(access: string): Promise<Account> {
    const j = await readJson(await fetch(`${G_API()}/youtube/v3/channels?part=snippet&mine=true`, { headers: { Authorization: `Bearer ${access}` } }))
    const c = j.items?.[0]
    if (!c) throw new PlatformError("на этом Google-аккаунте нет YouTube-канала")
    return { id: c.id, name: c.snippet?.title ?? null, avatar: c.snippet?.thumbnails?.default?.url ?? null }
  },
  async publish(post: PostRow, video: VideoRow, access: string): Promise<PublishResult> {
    const bytes = await fetchVideo(video)
    let title = (post.title || post.caption.split("\n")[0] || "EvilVerse").replace(/[<>]/g, "").trim()
    if (!/#shorts/i.test(title + post.caption)) title = (title.slice(0, 90) + " #Shorts").trim()
    const tags = Array.from(new Set((post.caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.slice(1)))).slice(0, 15)
    const meta = {
      snippet: { title: title.slice(0, 100), description: post.caption.replace(/[<>]/g, "").slice(0, 4900), tags, categoryId: "20" },
      status: { privacyStatus: ["public", "unlisted", "private"].includes(post.privacy ?? "") ? post.privacy : "public", selfDeclaredMadeForKids: false },
    }
    const init = await fetch(`${base("YOUTUBE_UPLOAD_URL", "https://www.googleapis.com/upload/youtube/v3/videos")}?uploadType=resumable&part=snippet,status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": video.mime || "video/mp4", "X-Upload-Content-Length": String(bytes.length) },
      body: JSON.stringify(meta),
    })
    if (!init.ok) throw ytError(init.status, await readJson(init))
    const loc = init.headers.get("location")
    if (!loc) throw new PlatformError("YouTube не дал адрес загрузки", true)
    const up = await fetch(loc, { method: "PUT", headers: { "Content-Type": video.mime || "video/mp4", "Content-Length": String(bytes.length) }, body: bytes })
    const j = await readJson(up)
    if (!up.ok || !j.id) throw ytError(up.status, j)
    return { state: "published", remoteId: j.id, remoteUrl: `https://youtube.com/shorts/${j.id}`,
      note: j.status?.uploadStatus === "rejected" ? "YouTube отклонил видео" : null }
  },
}
function ytError(status: number, j: any) {
  const reason = j?.error?.errors?.[0]?.reason || j?.error?.status || ""
  const msg = j?.error?.message || `HTTP ${status}`
  if (reason === "quotaExceeded" || reason === "uploadLimitExceeded") return new PlatformError("лимит загрузок YouTube на сегодня исчерпан, повторю позже", true, 6 * 60)
  if (status === 401) return new PlatformError("доступ к YouTube истёк, подключи канал заново", false, 0, true)
  if (status >= 500 || status === 429) return new PlatformError("YouTube временно недоступен: " + msg, true)
  return new PlatformError("YouTube: " + msg)
}

// =====================================================================================
// TikTok: Login Kit + Content Posting API
// =====================================================================================
const TT_AUTH = () => base("TIKTOK_AUTH_URL", "https://www.tiktok.com/v2/auth/authorize/")
const TT_API = () => base("TIKTOK_API_BASE", "https://open.tiktokapis.com")
const ttHeaders = (access: string) => ({ Authorization: `Bearer ${access}`, "Content-Type": "application/json; charset=UTF-8" })

export const tiktok = {
  configured: () => !!(env("TIKTOK_CLIENT_KEY") && env("TIKTOK_CLIENT_SECRET")),
  authUrl(state: string, redirectUri: string) {
    const p = new URLSearchParams({ client_key: env("TIKTOK_CLIENT_KEY"), response_type: "code", scope: "user.info.basic,video.publish,video.upload", redirect_uri: redirectUri, state })
    return `${TT_AUTH()}${TT_AUTH().includes("?") ? "&" : "?"}${p}`
  },
  async exchange(code: string, redirectUri: string): Promise<Tokens & { account: Account }> {
    const r = await fetch(`${TT_API()}/v2/oauth/token/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_key: env("TIKTOK_CLIENT_KEY"), client_secret: env("TIKTOK_CLIENT_SECRET"), code, grant_type: "authorization_code", redirect_uri: redirectUri }) })
    const j = await readJson(r)
    if (!r.ok || !j.access_token) throw new PlatformError("TikTok не выдал доступ: " + (j.error_description || j.error || r.status))
    if (!String(j.scope ?? "").includes("video.publish")) throw new PlatformError("не дано разрешение на публикацию видео — подключи TikTok ещё раз и отметь все пункты")
    const u = await readJson(await fetch(`${TT_API()}/v2/user/info/?fields=open_id,display_name,avatar_url`, { headers: ttHeaders(j.access_token) }))
    const user = u.data?.user ?? {}
    return { access: j.access_token, refresh: j.refresh_token, expiresIn: j.expires_in, refreshExpiresIn: j.refresh_expires_in, scopes: j.scope,
      account: { id: String(user.open_id || j.open_id), name: user.display_name ?? null, avatar: user.avatar_url ?? null } }
  },
  async refresh(refresh: string): Promise<Tokens> {
    const r = await fetch(`${TT_API()}/v2/oauth/token/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_key: env("TIKTOK_CLIENT_KEY"), client_secret: env("TIKTOK_CLIENT_SECRET"), grant_type: "refresh_token", refresh_token: refresh }) })
    const j = await readJson(r)
    if (!r.ok || !j.access_token) throw new PlatformError("доступ к TikTok истёк, подключи аккаунт заново", false, 0, true)
    return { access: j.access_token, refresh: j.refresh_token ?? refresh, expiresIn: j.expires_in, refreshExpiresIn: j.refresh_expires_in }
  },
  /** Что разрешено этому автору: варианты приватности, максимальная длина, можно ли постить прямо сейчас. */
  async creatorInfo(access: string) {
    const r = await fetch(`${TT_API()}/v2/post/publish/creator_info/query/`, { method: "POST", headers: ttHeaders(access), body: "{}" })
    const j = await readJson(r)
    if (j.error?.code && j.error.code !== "ok") throw ttError(r.status, j)
    return j.data as { creator_nickname?: string; creator_username?: string; creator_avatar_url?: string; privacy_level_options: string[]; max_video_post_duration_sec?: number; comment_disabled?: boolean; duet_disabled?: boolean; stitch_disabled?: boolean }
  },
  async publish(post: PostRow, video: VideoRow, access: string): Promise<PublishResult> {
    const info = await this.creatorInfo(access)
    const opts = info.privacy_level_options ?? []
    const privacy = opts.includes(post.privacy ?? "") ? post.privacy! : opts.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : opts[0]
    if (!privacy) throw new PlatformError("TikTok сейчас не разрешает этому аккаунту публиковать видео")
    if (info.max_video_post_duration_sec && video.duration && video.duration > info.max_video_post_duration_sec)
      throw new PlatformError(`ролик длиннее, чем разрешено аккаунту (${info.max_video_post_duration_sec} с)`)
    const bytes = await fetchVideo(video), size = bytes.length
    // до 64 МБ — одним куском; больше — кусками по 10 МБ, последний забирает остаток
    const chunk = size <= 64 * 1048576 ? size : 10 * 1048576, count = size <= 64 * 1048576 ? 1 : Math.floor(size / chunk)
    const r = await fetch(`${TT_API()}/v2/post/publish/video/init/`, { method: "POST", headers: ttHeaders(access), body: JSON.stringify({
      post_info: { title: post.caption.slice(0, 2200), privacy_level: privacy, disable_duet: false, disable_comment: false, disable_stitch: false,
        video_cover_timestamp_ms: 1000, brand_content_toggle: false, brand_organic_toggle: false },
      source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunk, total_chunk_count: count },
    }) })
    const j = await readJson(r)
    if (!r.ok || (j.error?.code && j.error.code !== "ok")) throw ttError(r.status, j)
    const { publish_id, upload_url } = j.data ?? {}
    if (!publish_id || !upload_url) throw new PlatformError("TikTok не дал адрес загрузки", true)
    for (let i = 0; i < count; i++) {
      const from = i * chunk, to = i === count - 1 ? size : from + chunk
      const up = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": video.mime || "video/mp4", "Content-Length": String(to - from), "Content-Range": `bytes ${from}-${to - 1}/${size}` }, body: bytes.subarray(from, to) })
      if (!up.ok && up.status !== 206) throw new PlatformError(`TikTok не принял файл (${up.status})`, true)
    }
    return { state: "processing", remoteId: publish_id, note: privacy === "SELF_ONLY" ? "видно только тебе (так TikTok разрешает до проверки приложения)" : null }
  },
  async poll(post: PostRow, access: string): Promise<PublishResult | null> {
    const r = await fetch(`${TT_API()}/v2/post/publish/status/fetch/`, { method: "POST", headers: ttHeaders(access), body: JSON.stringify({ publish_id: post.remote_id }) })
    const j = await readJson(r)
    if (j.error?.code && j.error.code !== "ok") throw ttError(r.status, j)
    const st = j.data?.status
    if (st === "PUBLISH_COMPLETE" || st === "SEND_TO_USER_INBOX") {
      const id = j.data?.publicaly_available_post_id?.[0]
      return { state: "published", remoteId: id ? String(id) : post.remote_id, remoteUrl: id ? `https://www.tiktok.com/video/${id}` : null,
        note: st === "SEND_TO_USER_INBOX" ? "черновик ждёт тебя во входящих TikTok" : id ? null : post.privacy === "SELF_ONLY" ? "опубликовано приватно — видно только тебе в профиле TikTok" : "опубликовано, ссылка появится после модерации TikTok" }
    }
    if (st === "FAILED") throw new PlatformError("TikTok отклонил ролик: " + (j.data?.fail_reason || "без причины"))
    return null // ещё обрабатывается
  },
}
function ttError(status: number, j: any) {
  const code = j?.error?.code || "", msg = j?.error?.message || `HTTP ${status}`
  if (code === "access_token_invalid" || status === 401) return new PlatformError("доступ к TikTok истёк, подключи аккаунт заново", false, 0, true)
  if (code === "spam_risk_too_many_posts" || code === "spam_risk_user_banned_from_posting") return new PlatformError("TikTok ограничил публикации для аккаунта на сегодня, повторю завтра", true, 24 * 60)
  if (code === "rate_limit_exceeded" || status === 429 || status >= 500) return new PlatformError("TikTok временно не отвечает: " + msg, true)
  if (code === "unaudited_client_can_only_post_to_private_accounts") return new PlatformError("пока приложение не прошло проверку TikTok, публиковать можно только в закрытый (приватный) аккаунт")
  return new PlatformError("TikTok: " + (code ? code + " — " : "") + msg)
}

// =====================================================================================
// Instagram: Reels через Instagram API with Instagram Login
// =====================================================================================
const IG_AUTH = () => base("INSTAGRAM_AUTH_URL", "https://www.instagram.com/oauth/authorize")
const IG_TOKEN = () => base("INSTAGRAM_TOKEN_URL", "https://api.instagram.com/oauth/access_token")
const IG_GRAPH = () => base("INSTAGRAM_GRAPH_BASE", "https://graph.instagram.com")
const IGV = () => env("INSTAGRAM_GRAPH_VERSION") || "v25.0"

export const instagram = {
  configured: () => !!(env("INSTAGRAM_APP_ID") && env("INSTAGRAM_APP_SECRET")),
  authUrl(state: string, redirectUri: string) {
    const p = new URLSearchParams({ client_id: env("INSTAGRAM_APP_ID"), redirect_uri: redirectUri, response_type: "code", state,
      scope: "instagram_business_basic,instagram_business_content_publish", enable_fb_login: "0", force_authentication: "1" })
    return `${IG_AUTH()}?${p}`
  },
  async exchange(code: string, redirectUri: string): Promise<Tokens & { account: Account }> {
    const r = await fetch(IG_TOKEN(), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_id: env("INSTAGRAM_APP_ID"), client_secret: env("INSTAGRAM_APP_SECRET"), grant_type: "authorization_code", redirect_uri: redirectUri, code: code.replace(/#_$/, "") }) })
    const j0 = await readJson(r), j = j0.data?.[0] ?? j0
    if (!r.ok || !j.access_token) throw new PlatformError("Instagram не выдал доступ: " + (j0.error_message || j0.error?.message || r.status))
    // короткий ключ (1 час) → долгий (60 дней)
    const l = await readJson(await fetch(`${IG_GRAPH()}/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: env("INSTAGRAM_APP_SECRET"), access_token: j.access_token })}`))
    const access = l.access_token || j.access_token
    const me = await readJson(await fetch(`${IG_GRAPH()}/${IGV()}/me?fields=user_id,username,profile_picture_url,account_type&access_token=${encodeURIComponent(access)}`))
    if (me.account_type && !["BUSINESS", "MEDIA_CREATOR", "CREATOR"].includes(String(me.account_type).toUpperCase()))
      throw new PlatformError("публиковать Reels через API можно только с профессионального аккаунта («Автор» или «Бизнес») — переключи тип аккаунта в настройках Instagram")
    return { access, expiresIn: l.expires_in ?? 3600, scopes: j.permissions ? String(j.permissions) : null,
      account: { id: String(me.user_id || j.user_id), name: me.username ?? null, avatar: me.profile_picture_url ?? null } }
  },
  async refresh(access: string): Promise<Tokens> {
    const j = await readJson(await fetch(`${IG_GRAPH()}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(access)}`))
    if (!j.access_token) throw new PlatformError("доступ к Instagram истёк, подключи аккаунт заново", false, 0, true)
    return { access: j.access_token, expiresIn: j.expires_in ?? 60 * 86400 }
  },
  async publish(post: PostRow, video: VideoRow, access: string, accountId: string): Promise<PublishResult> {
    const r = await fetch(`${IG_GRAPH()}/${IGV()}/${accountId}/media`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_type: "REELS", video_url: video.url, caption: post.caption.slice(0, 2200), share_to_feed: true, access_token: access }) })
    const j = await readJson(r)
    if (!r.ok || !j.id) throw igError(r.status, j)
    return { state: "processing", remoteId: "c:" + j.id }
  },
  async poll(post: PostRow, access: string, accountId: string): Promise<PublishResult | null> {
    const id = String(post.remote_id ?? "")
    if (!id.startsWith("c:")) return { state: "published", remoteId: id }
    const cid = id.slice(2)
    const s = await readJson(await fetch(`${IG_GRAPH()}/${IGV()}/${cid}?fields=status_code,status&access_token=${encodeURIComponent(access)}`))
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new PlatformError("Instagram не обработал ролик: " + (s.status || s.status_code))
    if (s.status_code !== "FINISHED") return null
    const p = await fetch(`${IG_GRAPH()}/${IGV()}/${accountId}/media_publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creation_id: cid, access_token: access }) })
    const pj = await readJson(p)
    if (!p.ok || !pj.id) throw igError(p.status, pj)
    const link = await readJson(await fetch(`${IG_GRAPH()}/${IGV()}/${pj.id}?fields=permalink&access_token=${encodeURIComponent(access)}`))
    return { state: "published", remoteId: String(pj.id), remoteUrl: link.permalink ?? null }
  },
}
function igError(status: number, j: any) {
  const e = j?.error ?? {}, msg = e.error_user_msg || e.message || `HTTP ${status}`
  if (e.code === 190 || status === 401) return new PlatformError("доступ к Instagram истёк, подключи аккаунт заново", false, 0, true)
  if (e.code === 9 || e.code === 4 || e.code === 32 || status === 429) return new PlatformError("Instagram ограничил публикации на время, повторю позже", true, 60)
  if (status >= 500) return new PlatformError("Instagram временно недоступен: " + msg, true)
  return new PlatformError("Instagram: " + msg)
}

// =====================================================================================
// Discord: только вход в студию
// =====================================================================================
const D_AUTH = () => base("DISCORD_AUTH_URL", "https://discord.com/oauth2/authorize")
const D_API = () => base("DISCORD_API_BASE", "https://discord.com/api/v10")
const D_CDN = () => base("DISCORD_CDN_BASE", "https://cdn.discordapp.com")

export const discord = {
  configured: () => !!(env("DISCORD_CLIENT_ID") && env("DISCORD_CLIENT_SECRET")),
  authUrl(state: string, redirectUri: string) {
    const p = new URLSearchParams({ client_id: env("DISCORD_CLIENT_ID"), redirect_uri: redirectUri, response_type: "code", scope: "identify email", state, prompt: "none" })
    return `${D_AUTH()}?${p}`
  },
  async exchange(code: string, redirectUri: string): Promise<Account> {
    const r = await fetch(`${D_API()}/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ code, client_id: env("DISCORD_CLIENT_ID"), client_secret: env("DISCORD_CLIENT_SECRET"), redirect_uri: redirectUri, grant_type: "authorization_code" }) })
    const j = await readJson(r)
    if (!r.ok || !j.access_token) throw new PlatformError("Discord не выдал доступ: " + (j.error_description || j.error || r.status))
    const u = await readJson(await fetch(`${D_API()}/users/@me`, { headers: { Authorization: `Bearer ${j.access_token}` } }))
    if (!u.id) throw new PlatformError("Discord не вернул профиль")
    // токен Discord дальше не нужен — отзываем, чтобы не висел
    fetch(`${D_API()}/oauth2/token/revoke`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ token: j.access_token, token_type_hint: "access_token", client_id: env("DISCORD_CLIENT_ID"), client_secret: env("DISCORD_CLIENT_SECRET") }) }).catch(() => {})
    const avatar = u.avatar ? `${D_CDN()}/avatars/${u.id}/${u.avatar}.${String(u.avatar).startsWith("a_") ? "gif" : "png"}?size=128` : null
    return { id: String(u.id), name: u.global_name || u.username || null, avatar, email: u.verified && u.email ? String(u.email).toLowerCase() : null }
  },
}

export const PLATFORMS = { tiktok, youtube: google, instagram } as const
export type PlatformKey = keyof typeof PLATFORMS
export const isPlatform = (p: string): p is PlatformKey => p === "tiktok" || p === "youtube" || p === "instagram"
export const platformConfigured = (p: PlatformKey) => PLATFORMS[p].configured()
export { sleep }
