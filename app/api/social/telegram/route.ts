import { NICK_RE } from "@/lib/catalog"
import { botUsername } from "@/lib/social"
import { ensureWebhook } from "@/lib/stars"

export const dynamic = "force-dynamic"

// Посилання з гри: /api/social/telegram?nick=Нік → бот t.me/<бот>?start=tg_Нік (бот перевіряє підписку на канал)
export async function GET(req: Request) {
  const nick = new URL(req.url).searchParams.get("nick") ?? ""
  if (!NICK_RE.test(nick)) return new Response("Невірний нік", { status: 400 })
  try {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || req.headers.get("x-forwarded-host") || req.headers.get("host")
    if (host && process.env.VERCEL_ENV !== "preview") await ensureWebhook(`https://${host}`)
    const bot = await botUsername()
    if (!bot) return new Response("Telegram-бот не налаштований", { status: 503 })
    return Response.redirect(`https://t.me/${bot}?start=tg_${nick}`, 302)
  } catch (error) {
    console.error("[social tg]", error)
    return new Response("Помилка, спробуй пізніше", { status: 500 })
  }
}
