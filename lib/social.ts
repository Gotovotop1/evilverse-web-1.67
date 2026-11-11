import { randomBytes } from "crypto"
import { NICK_RE } from "@/lib/catalog"
import { pool } from "@/lib/db"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { kvGet, kvSet } from "@/lib/kv"
import { starsConfigured, tg } from "@/lib/stars"

/*
 * Нагорода за підписку на Telegram-канал.
 *   TELEGRAM_CHANNEL — @username каналу (бот оплати має бути АДМІНОМ каналу, інакше Telegram не скаже, чи підписаний гравець)
 * Гравець у грі тисне іконку → /api/social/telegram?nick=Нік → бот (t.me/<бот>?start=tg_Нік)
 * → бот перевіряє підписку → «замовлення» з товаром social_tg → сервер видає нагороду (команди — у config.yml HellPrime).
 * Один Telegram-акаунт — одна нагорода, один нік — одна нагорода.
 */

export const channel = () => (process.env.TELEGRAM_CHANNEL ?? "").trim()

export async function botUsername(): Promise<string | null> {
  if (!starsConfigured()) return null
  const cached = await kvGet("tg_bot_username").catch(() => null)
  if (cached) return cached
  const me = await tg("getMe", {})
  if (me?.username) await kvSet("tg_bot_username", me.username).catch(() => {})
  return me?.username ?? null
}

export async function isSubscribed(userId: number) {
  const m = await tg("getChatMember", { chat_id: channel(), user_id: userId })
  return ["creator", "administrator", "member"].includes(m?.status) || (m?.status === "restricted" && m?.is_member)
}

export type TgClaim = "ok" | "not_subscribed" | "tg_used" | "nick_used" | "bad_nick" | "no_channel"

export async function claimTelegram(userId: number, nick: string): Promise<TgClaim> {
  if (!channel()) return "no_channel"
  if (!NICK_RE.test(nick)) return "bad_nick"
  if (!(await isSubscribed(userId))) return "not_subscribed"
  await ensureDeliveryColumns()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const usedTg = await client.query(`SELECT nick FROM social_claims WHERE kind = 'telegram' AND account = $1`, [String(userId)])
    if (usedTg.rowCount) { await client.query("ROLLBACK"); return "tg_used" }
    const ins = await client.query(
      `INSERT INTO social_claims (kind, account, nick) VALUES ('telegram', $1, $2) ON CONFLICT DO NOTHING RETURNING id`,
      [String(userId), nick],
    )
    if (!ins.rowCount) { await client.query("ROLLBACK"); return "nick_used" }
    const code = `SOC-${randomBytes(4).toString("hex").toUpperCase()}`
    await client.query(
      `INSERT INTO orders (code, nick, discord, method, items, subtotal, discount, total, status, paid_at, payment_log)
       VALUES ($1, $2, '-', 'social', $3, 0, 0, 0, 'paid', now(), $4)`,
      [code, nick, JSON.stringify([{ id: "social_tg", dur: "", qty: 1, unit: 0 }]), JSON.stringify([`підписка на Telegram ${channel()} (tg id ${userId})`])],
    )
    await client.query("COMMIT")
    return "ok"
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/** Обробка /start tg_<нік> у боті. Повертає true, якщо повідомлення оброблено. */
export async function handleSocialStart(chatId: number, userId: number, text: string) {
  const m = /^\/start\s+tg_([A-Za-z0-9_]{3,16})$/.exec(text.trim())
  if (!m) return false
  const nick = m[1]
  const ch = channel()
  const result = await claimTelegram(userId, nick)
  const channelUrl = ch ? `https://t.me/${ch.replace(/^@/, "")}` : null
  const texts: Record<TgClaim, string> = {
    ok: `✅ Подписка проверена! Награда для ${nick} придёт в игре в течение минуты.`,
    not_subscribed: `❌ Ты ещё не подписан на канал. Подпишись и нажми «Проверить ещё раз».`,
    tg_used: `Этот Telegram уже получал награду (одна награда на аккаунт).`,
    nick_used: `Ник ${nick} уже получал награду за Telegram.`,
    bad_nick: `Неверный ник.`,
    no_channel: `Награда за Telegram ещё не настроена. Напиши администрации.`,
  }
  const keyboard = result === "not_subscribed" && channelUrl
    ? { inline_keyboard: [[{ text: "📢 Подписаться", url: channelUrl }], [{ text: "🔄 Проверить ещё раз", url: `https://t.me/${await botUsername()}?start=tg_${nick}` }]] }
    : undefined
  await tg("sendMessage", { chat_id: chatId, text: texts[result], ...(keyboard ? { reply_markup: keyboard } : {}) }).catch(() => {})
  return true
}
