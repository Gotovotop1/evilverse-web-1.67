import { desc, eq } from "drizzle-orm"
import { bearerMatches } from "@/lib/auth"
import { db } from "@/lib/db"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { orders } from "@/lib/db/schema"
import { clientIp, rateLimited } from "@/lib/server-utils"
import { checkMonoPayments, monoStatus } from "@/lib/mono"

export const dynamic = "force-dynamic"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

function guard(req: Request) {
  if (rateLimited(`admin:${clientIp(req)}`, 60, 5 * 60_000)) return json({ error: "too_many_requests" }, 429)
  const ok = bearerMatches(req, process.env.ADMIN_TOKEN)
  if (ok === null) return json({ error: "ADMIN_TOKEN is not configured" }, 503)
  if (!ok) return json({ error: "unauthorized" }, 401)
  return null
}

// GET ?status=pending|paid|cancelled|all — останні 200 замовлень для адмін-сторінки /admin.html
export async function GET(req: Request) {
  const denied = guard(req)
  if (denied) return denied
  await ensureDeliveryColumns()
  await checkMonoPayments()
  const status = new URL(req.url).searchParams.get("status") ?? "all"
  const base = db.select().from(orders)
  const rows = await (["pending", "paid", "cancelled"].includes(status) ? base.where(eq(orders.status, status)) : base)
    .orderBy(desc(orders.createdAt))
    .limit(200)
  return json({ orders: rows, mono: await monoStatus() })
}

// PATCH { code, status: "paid" | "cancelled" | "pending" } — підтвердити/скасувати оплату.
// PATCH { code, redeliver: true } — повторно поставити оплачене замовлення в чергу видачі
// (сервер не видасть повторно те, що вже видав: у плагіна свій журнал виданих замовлень).
export async function PATCH(req: Request) {
  const denied = guard(req)
  if (denied) return denied
  await ensureDeliveryColumns()

  const body = await req.json().catch(() => null)
  const code = String(body?.code ?? "")
  if (body?.redeliver === true) {
    const updated = await db
      .update(orders)
      .set({ deliveryStatus: null, deliveredAt: null })
      .where(eq(orders.code, code))
      .returning({ code: orders.code, status: orders.status })
    if (!updated.length) return json({ error: "not_found" }, 404)
    return json(updated[0])
  }

  const status = String(body?.status ?? "")
  if (!["paid", "cancelled", "pending"].includes(status)) return json({ error: "bad_status" }, 400)
  const updated = await db
    .update(orders)
    .set({ status, paidAt: status === "paid" ? new Date() : null })
    .where(eq(orders.code, code))
    .returning({ code: orders.code, status: orders.status })
  if (!updated.length) return json({ error: "not_found" }, 404)
  return json(updated[0])
}
