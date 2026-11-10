import { handleUpdate, starsConfigured, webhookSecretMatches } from "@/lib/stars"
import { kvSet } from "@/lib/kv"

export const dynamic = "force-dynamic"

// POST /api/telegram — вебхук бота оплати (Telegram Stars). Приймає лише запити з правильним секретним заголовком.
export async function POST(req: Request) {
  if (!starsConfigured()) return new Response("disabled", { status: 404 })
  if (!webhookSecretMatches(req.headers.get("x-telegram-bot-api-secret-token"))) return new Response("forbidden", { status: 403 })
  const update = await req.json().catch(() => null)
  if (update) {
    try {
      await handleUpdate(update)
    } catch (error: any) {
      console.error("[stars]", error)
      await kvSet("stars_last_error", `${new Date().toISOString()} ${String(error?.message ?? error)}`).catch(() => {})
    }
  }
  return Response.json({ ok: true })
}
