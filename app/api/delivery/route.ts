import { and, asc, eq, isNull } from "drizzle-orm"
import { bearerMatches } from "@/lib/auth"
import { db } from "@/lib/db"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { orders } from "@/lib/db/schema"
import { sendDiscordWebhook } from "@/lib/server-utils"
import { checkMonoPayments } from "@/lib/mono"

export const dynamic = "force-dynamic"

/*
 * Автовидача: Minecraft-сервер (плагін HellPrime) сам забирає оплачені замовлення.
 *   GET  /api/delivery            → { orders: [{ code, player, items: [{ id, dur, qty, unit }] }] }
 *   POST /api/delivery            ← { code, status: "delivered" | "manual" | "failed", log: [], manual: [] }
 * Доступ — лише з токеном DELIVERY_TOKEN (той самий рядок у config.yml плагіна → web-shop.token).
 * Сайт НЕ передає команди: що виконати для кожного товару, вирішує конфіг плагіна.
 */

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

function check(req: Request) {
  const ok = bearerMatches(req, process.env.DELIVERY_TOKEN)
  if (ok === null) return json({ error: "DELIVERY_TOKEN is not configured" }, 503)
  if (!ok) return json({ error: "unauthorized" }, 401)
  return null
}

export async function GET(req: Request) {
  const denied = check(req)
  if (denied) return denied
  await ensureDeliveryColumns()
  // Сервер опитує сайт кожні ~15 с — заодно перевіряємо банку monobank (сама обмежує частоту до 1/хв)
  await checkMonoPayments()
  const rows = await db
    .select({ code: orders.code, nick: orders.nick, giftTo: orders.giftTo, items: orders.items })
    .from(orders)
    .where(and(eq(orders.status, "paid"), isNull(orders.deliveryStatus), eq(orders.isDemo, false)))
    .orderBy(asc(orders.paidAt))
    .limit(50)
  return json({
    orders: rows.map((o) => ({
      code: o.code,
      player: o.giftTo || o.nick,
      items: o.items.map((i) => ({ id: i.id, dur: i.dur, qty: i.qty, unit: i.unit })),
    })),
  })
}

export async function POST(req: Request) {
  const denied = check(req)
  if (denied) return denied
  await ensureDeliveryColumns()
  const body = await req.json().catch(() => null)
  const code = String(body?.code ?? "")
  const status = String(body?.status ?? "")
  if (!["delivered", "manual", "failed"].includes(status)) return json({ error: "bad_status" }, 400)
  const log = Array.isArray(body?.log) ? body.log.map(String).slice(0, 50).map((s: string) => s.slice(0, 300)) : []
  const manual = Array.isArray(body?.manual) ? body.manual.map(String).slice(0, 20).map((s: string) => s.slice(0, 100)) : []

  const updated = await db
    .update(orders)
    .set({ deliveryStatus: status, deliveredAt: new Date(), deliveryLog: log, deliveryManual: manual })
    .where(and(eq(orders.code, code), eq(orders.status, "paid")))
    .returning({ code: orders.code, nick: orders.nick, giftTo: orders.giftTo })
  if (!updated.length) return json({ error: "not_found" }, 404)

  if (status !== "delivered") {
    const o = updated[0]
    void sendDiscordWebhook({
      allowed_mentions: { parse: [] },
      embeds: [{
        title: status === "manual" ? `Потрібна ручна видача: ${code}` : `Помилка видачі: ${code}`,
        color: status === "manual" ? 0xffb300 : 0xff2424,
        fields: [
          { name: "Гравець", value: o.giftTo || o.nick, inline: true },
          ...(manual.length ? [{ name: "Видати вручну", value: manual.join("\n").slice(0, 1000) }] : []),
          ...(log.length ? [{ name: "Журнал", value: log.join("\n").slice(0, 1000) }] : []),
        ],
      }],
    })
  }
  return json({ ok: true })
}
