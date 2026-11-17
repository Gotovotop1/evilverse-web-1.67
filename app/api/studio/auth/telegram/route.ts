import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { createSession, env, fail, handler, json, preflight, upsertUser } from "@/lib/studio/core"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

/** Вход через Telegram Login Widget: проверяем подпись данных ключом бота. */
export const POST = handler(async (req) => {
  const bot = env("TELEGRAM_BOT_TOKEN")
  if (!bot || !env("TELEGRAM_LOGIN_BOT")) return fail(req, "Вход через Telegram ещё не настроен", 503)
  const d = await req.json().catch(() => null) as Record<string, string | number> | null
  if (!d || !d.hash || !d.id || !d.auth_date) return fail(req, "Нет данных Telegram")
  const check = Object.keys(d).filter((k) => k !== "hash" && d[k] !== undefined && d[k] !== null).sort().map((k) => `${k}=${d[k]}`).join("\n")
  const want = createHmac("sha256", createHash("sha256").update(bot).digest()).update(check).digest("hex")
  const a = Buffer.from(String(d.hash)), b = Buffer.from(want)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail(req, "Подпись Telegram не сошлась", 401)
  if (Date.now() / 1000 - Number(d.auth_date) > 86400) return fail(req, "Данные Telegram устарели, войди ещё раз", 401)
  const name = [d.first_name, d.last_name].filter(Boolean).join(" ") || (d.username ? "@" + d.username : null)
  const u = await upsertUser("telegram_id", String(d.id), { name: name as string | null, avatar: (d.photo_url as string) ?? null })
  return json(req, { token: await createSession(u.id) })
})
