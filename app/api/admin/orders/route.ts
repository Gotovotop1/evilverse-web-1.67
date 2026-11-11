import { and, desc, eq } from "drizzle-orm"
import { bearerMatches } from "@/lib/auth"
import { db } from "@/lib/db"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { orders } from "@/lib/db/schema"
import { clientIp, rateLimited } from "@/lib/server-utils"
import { checkPayments, paymentsStatus } from "@/lib/payments"
import { refundStars } from "@/lib/stars"

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
  await checkPayments()
  const status = new URL(req.url).searchParams.get("status") ?? "all"
  const base = db.select().from(orders)
  const filtered = status === "prefix" ? base.where(eq(orders.prefixStatus, "pending"))
    : ["pending", "paid", "cancelled"].includes(status) ? base.where(eq(orders.status, status)) : base
  const rows = await filtered
    .orderBy(desc(orders.createdAt))
    .limit(200)
  return json({ orders: rows, payments: await paymentsStatus() })
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
  // { code, prefix: "approve" | "reject", note? } — решение по личному префиксу
  if (body?.prefix === "approve" || body?.prefix === "reject") {
    const note = body?.note ? String(body.note).slice(0, 200) : null
    const updated = await db
      .update(orders)
      .set({ prefixStatus: body.prefix === "approve" ? "approved" : "rejected", prefixNote: note })
      .where(and(eq(orders.code, code), eq(orders.prefixStatus, "pending")))
      .returning({ code: orders.code, prefixStatus: orders.prefixStatus, items: orders.items, status: orders.status, method: orders.method })
    if (!updated.length) return json({ error: "not_pending" }, 404)
    const o = updated[0]
    // бесплатная заявка, в которой был только префикс, после отказа — закрыта; иначе остальные товары выдаются как обычно
    if (o.prefixStatus === "rejected" && o.items.every((i) => i.id === "prefix")) {
      await db.update(orders).set({ deliveryStatus: "manual", deliveryLog: [`префікс відхилено${note ? `: ${note}` : ""}`], deliveredAt: new Date() })
        .where(eq(orders.code, code))
    }
    return json({ code: o.code, prefixStatus: o.prefixStatus })
  }

  // { code, refundStars: true } — повернути зірки Telegram (тестова покупка / повернення гравцю)
  if (body?.refundStars === true) {
    try {
      const r = await refundStars(code)
      return "error" in r ? json(r, 409) : json(r)
    } catch (error) {
      return json({ error: String((error as Error)?.message ?? error) }, 502)
    }
  }

  // { code, demo: true | false } — тестовый заказ: не показывается в ленте покупок и топе донатеров
  // (и, если ещё не выдан, не выдаётся на сервер). Отмечай так только свои проверки.
  if (typeof body?.demo === "boolean") {
    const updated = await db
      .update(orders)
      .set({ isDemo: body.demo })
      .where(eq(orders.code, code))
      .returning({ code: orders.code, isDemo: orders.isDemo })
    if (!updated.length) return json({ error: "not_found" }, 404)
    return json(updated[0])
  }

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
