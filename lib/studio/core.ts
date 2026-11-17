/*
 * EvilVerse Studio — аккаунты и автопостинг.
 * © 2026 EvilVerse (evilverse.lol). Все права защищены.
 *
 * Общие вещи: таблицы, шифрование ключей доступа, сессии, CORS для studio.evilverse.lol.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { pool } from "@/lib/db"

// ---------- настройки ----------
export const env = (k: string) => (process.env[k] ?? "").trim()
export const STUDIO_URL = () => env("STUDIO_URL") || "https://studio.evilverse.lol"
/** Публичный адрес этого сайта (для redirect_uri). */
export function siteUrl(req?: Request) {
  const fixed = env("STUDIO_API_URL")
  if (fixed) return fixed.replace(/\/$/, "")
  if (req) { const u = new URL(req.url); const host = req.headers.get("x-forwarded-host") || u.host; const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", ""); return `${proto}://${host}` }
  return "https://shop.evilverse.lol"
}
export const secretOk = () => env("STUDIO_SECRET").length >= 32

// ---------- таблицы (создаются сами при первом запросе, ничего не удаляют) ----------
let ready: Promise<void> | null = null
export function ensureStudioTables() {
  ready ??= pool.query(`
    CREATE TABLE IF NOT EXISTS studio_users (
      id bigserial PRIMARY KEY,
      email text UNIQUE,
      google_sub text UNIQUE,
      telegram_id text UNIQUE,
      name text,
      avatar text,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen timestamptz
    );
    CREATE TABLE IF NOT EXISTS studio_sessions (
      token_hash text PRIMARY KEY,
      user_id bigint NOT NULL REFERENCES studio_users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS studio_tickets (
      ticket_hash text PRIMARY KEY,
      user_id bigint NOT NULL REFERENCES studio_users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS studio_login_codes (
      email text PRIMARY KEY,
      code_hash text NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      expires_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS studio_social (
      id bigserial PRIMARY KEY,
      user_id bigint NOT NULL REFERENCES studio_users(id) ON DELETE CASCADE,
      platform text NOT NULL,
      account_id text NOT NULL,
      name text,
      avatar text,
      access_enc text NOT NULL,
      refresh_enc text,
      expires_at timestamptz,
      refresh_expires_at timestamptz,
      scopes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, platform)
    );
    CREATE TABLE IF NOT EXISTS studio_videos (
      id bigserial PRIMARY KEY,
      user_id bigint NOT NULL REFERENCES studio_users(id) ON DELETE CASCADE,
      url text NOT NULL,
      size bigint NOT NULL,
      duration real,
      mime text,
      title text,
      created_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS studio_posts (
      id bigserial PRIMARY KEY,
      user_id bigint NOT NULL REFERENCES studio_users(id) ON DELETE CASCADE,
      video_id bigint NOT NULL REFERENCES studio_videos(id) ON DELETE CASCADE,
      platform text NOT NULL,
      title text,
      caption text NOT NULL DEFAULT '',
      privacy text,
      scheduled_at timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'scheduled',
      attempts integer NOT NULL DEFAULT 0,
      locked_at timestamptz,
      remote_id text,
      remote_url text,
      error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE studio_social ADD COLUMN IF NOT EXISTS broken text;
    CREATE INDEX IF NOT EXISTS studio_posts_due ON studio_posts (status, scheduled_at);
    CREATE INDEX IF NOT EXISTS studio_posts_user ON studio_posts (user_id, scheduled_at);
  `).then(() => undefined).catch((e) => { ready = null; throw e })
  return ready
}

// ---------- шифрование ключей доступа (AES-256-GCM, ключ из STUDIO_SECRET) ----------
const key = () => createHash("sha256").update("evs-studio-v1:" + env("STUDIO_SECRET")).digest()
export function seal(plain: string | null | undefined) {
  if (!plain) return null
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv)
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()])
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".")
}
export function unseal(box: string | null | undefined) {
  if (!box) return null
  const [v, iv, tag, body] = box.split(".")
  if (v !== "v1") return null
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"))
  d.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8")
}
export const sha = (s: string) => createHash("sha256").update(s).digest("hex")
export const randomToken = (n = 32) => randomBytes(n).toString("base64url")

/** Подписанное состояние для OAuth (без хранения в базе), живёт 15 минут. */
export function signState(data: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify({ ...data, ts: Date.now(), n: randomToken(8) })).toString("base64url")
  const mac = createHmac("sha256", key()).update(body).digest("base64url")
  return body + "." + mac
}
export function readState(state: string | null): Record<string, any> | null {
  if (!state) return null
  const [body, mac] = state.split(".")
  if (!body || !mac) return null
  const want = createHmac("sha256", key()).update(body).digest("base64url")
  const a = Buffer.from(mac), b = Buffer.from(want)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try { const d = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); return Date.now() - d.ts < 15 * 60_000 ? d : null } catch { return null }
}

// ---------- сессии ----------
export async function createSession(userId: number | string) {
  const token = randomToken()
  await pool.query(`INSERT INTO studio_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '60 days')`, [sha(token), userId])
  await pool.query(`UPDATE studio_users SET last_seen = now() WHERE id = $1`, [userId])
  return token
}
export async function userFromRequest(req: Request) {
  const t = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim()
  if (!t || t.length < 20) return null
  await ensureStudioTables()
  const r = await pool.query(
    `SELECT u.* FROM studio_sessions s JOIN studio_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()`, [sha(t)])
  return r.rows[0] ?? null
}
/** Одноразовый билет, чтобы открыть страницу подключения соцсети без передачи сессии в адресе. */
export async function createTicket(userId: number | string) {
  const t = randomToken(24)
  await pool.query(`DELETE FROM studio_tickets WHERE expires_at < now()`)
  await pool.query(`INSERT INTO studio_tickets (ticket_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '3 minutes')`, [sha(t), userId])
  return t
}
export async function useTicket(t: string | null) {
  if (!t) return null
  await ensureStudioTables()
  const r = await pool.query(`DELETE FROM studio_tickets WHERE ticket_hash = $1 AND expires_at > now() RETURNING user_id`, [sha(t)])
  return r.rows[0]?.user_id ?? null
}

/** Находит или создаёт пользователя по одному из способов входа. */
export async function upsertUser(by: "email" | "google_sub" | "telegram_id", value: string, extra: { email?: string | null; name?: string | null; avatar?: string | null } = {}) {
  await ensureStudioTables()
  const found = await pool.query(`SELECT * FROM studio_users WHERE ${by} = $1`, [value])
  if (found.rows[0]) {
    await pool.query(`UPDATE studio_users SET name = COALESCE($2, name), avatar = COALESCE($3, avatar) WHERE id = $1`, [found.rows[0].id, extra.name ?? null, extra.avatar ?? null])
    return found.rows[0]
  }
  // вход через Google с почтой, на которую уже есть аккаунт, — это тот же человек
  if (by === "google_sub" && extra.email) {
    const same = await pool.query(`UPDATE studio_users SET google_sub = $2, name = COALESCE(name, $3), avatar = COALESCE(avatar, $4) WHERE email = $1 RETURNING *`, [extra.email, value, extra.name ?? null, extra.avatar ?? null])
    if (same.rows[0]) return same.rows[0]
  }
  const email = by === "email" ? value : extra.email ?? null
  // почта уже занята другим аккаунтом (например, вход через Telegram у того же человека) — не привязываем её второй раз
  const taken = email && by !== "email" ? (await pool.query(`SELECT 1 FROM studio_users WHERE email = $1`, [email])).rows.length > 0 : false
  const r = by === "email"
    ? await pool.query(`INSERT INTO studio_users (email, name, avatar) VALUES ($1, $2, $3) RETURNING *`, [value, extra.name ?? null, extra.avatar ?? null])
    : await pool.query(`INSERT INTO studio_users (${by}, email, name, avatar) VALUES ($1, $2, $3, $4) RETURNING *`, [value, taken ? null : email, extra.name ?? null, extra.avatar ?? null])
  return r.rows[0]
}

// ---------- CORS и ответы ----------
const ORIGINS = () => [STUDIO_URL(), ...env("STUDIO_EXTRA_ORIGINS").split(",").map((x) => x.trim()).filter(Boolean)]
export function corsHeaders(req: Request): Record<string, string> {
  const o = req.headers.get("origin") ?? ""
  const h: Record<string, string> = { Vary: "Origin", "Cache-Control": "no-store" }
  if (o && ORIGINS().includes(o)) {
    h["Access-Control-Allow-Origin"] = o
    h["Access-Control-Allow-Headers"] = "authorization, content-type"
    h["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"
    h["Access-Control-Max-Age"] = "600"
  }
  return h
}
export const preflight = (req: Request) => new Response(null, { status: 204, headers: corsHeaders(req) })
export const json = (req: Request, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" } })
export const fail = (req: Request, message: string, status = 400, extra: Record<string, unknown> = {}) => json(req, { error: message, ...extra }, status)

/** Ответ-редирект обратно в студию: токен — во фрагменте (#), он не уходит на сервер и в логи. */
export function backToStudio(params: Record<string, string>, frag: Record<string, string> = {}) {
  const u = new URL(STUDIO_URL())
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const f = new URLSearchParams(frag).toString()
  return Response.redirect(u.toString() + (f ? "#" + f : ""), 302)
}

/** Обёртка для обработчиков: общий отлов ошибок, проверка секрета и базы. */
export function handler(fn: (req: Request, ctx: any) => Promise<Response>) {
  return async (req: Request, ctx: any) => {
    try {
      if (!secretOk()) return fail(req, "Студия не настроена: нет STUDIO_SECRET", 503, { code: "not_configured" })
      if (!env("DATABASE_URL")) return fail(req, "Студия не настроена: нет базы данных", 503, { code: "not_configured" })
      await ensureStudioTables()
      return await fn(req, ctx)
    } catch (e: any) {
      console.error("studio api", e)
      return fail(req, "Ошибка сервера: " + (e?.message || String(e)).slice(0, 200), 500)
    }
  }
}
export async function requireUser(req: Request) {
  const u = await userFromRequest(req)
  if (!u) throw Object.assign(new Error("unauthorized"), { status: 401 })
  return u
}
export function authed(fn: (req: Request, user: any, ctx: any) => Promise<Response>) {
  return handler(async (req, ctx) => {
    const u = await userFromRequest(req)
    if (!u) return fail(req, "Нужно войти в аккаунт студии", 401, { code: "unauthorized" })
    return fn(req, u, ctx)
  })
}
