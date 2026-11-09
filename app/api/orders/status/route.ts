import { inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { orders } from "@/lib/db/schema"
import { clientIp, rateLimited } from "@/lib/server-utils"

export const dynamic = "force-dynamic"

// GET /api/orders/status?codes=EV-AAA111,EV-BBB222 — статус своїх замовлень для вкладки «Кабінет».
// Повертає лише статус (без ніку, Discord чи суми), тож знання коду нічого не розкриває.
export async function GET(req: Request) {
  if (rateLimited(`ostatus:${clientIp(req)}`, 30, 60_000)) return Response.json({ error: "too_many_requests" }, { status: 429 })
  const codes = (new URL(req.url).searchParams.get("codes") ?? "")
    .split(",").map((c) => c.trim().toUpperCase()).filter((c) => /^EV-[A-Z0-9]{4,12}$/.test(c)).slice(0, 30)
  if (!codes.length) return Response.json({ orders: {} })
  await ensureDeliveryColumns()
  const rows = await db
    .select({ code: orders.code, status: orders.status, delivery: orders.deliveryStatus })
    .from(orders)
    .where(inArray(orders.code, codes))
  const result: Record<string, { status: string; delivery: string | null }> = {}
  for (const r of rows) result[r.code] = { status: r.status, delivery: r.delivery }
  return Response.json({ orders: result }, { headers: { "Cache-Control": "no-store" } })
}
