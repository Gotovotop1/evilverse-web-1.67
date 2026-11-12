import { botUsername, channel } from "@/lib/social"
import { starsConfigured, tg } from "@/lib/stars"

export const dynamic = "force-dynamic"

/*
 * Проверка налаштування нагороди за Telegram (без секретів):
 *   { bot, channel, channelFound, botIsAdmin } — чи бачить бот канал і чи він там адмін
 * (без адмінки Telegram не скаже боту, чи підписаний гравець).
 */
export async function GET() {
  const out: Record<string, unknown> = { botConfigured: starsConfigured(), channel: channel() || null }
  try {
    const bot = await botUsername()
    out.bot = bot ? `@${bot}` : null
    if (!out.channel || !bot) return Response.json(out)
    const chat = await tg("getChat", { chat_id: channel() }).catch((e) => ({ error: String(e?.message ?? e) }))
    out.channelFound = !("error" in chat)
    if ("error" in chat) out.channelError = chat.error
    else out.channelTitle = chat.title
    const me = await tg("getMe", {})
    const member = await tg("getChatMember", { chat_id: channel(), user_id: me.id }).catch((e) => ({ status: `error: ${e?.message ?? e}` }))
    out.botStatus = member.status
    out.botIsAdmin = member.status === "administrator" || member.status === "creator"
  } catch (error: any) {
    out.error = String(error?.message ?? error)
  }
  return Response.json(out, { headers: { "Cache-Control": "no-store" } })
}
