import { timingSafeEqual } from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { orders } from "@/lib/db/schema"
import { clientIp, rateLimited } from "@/lib/server-utils"

export const dynamic = "force-dynamic"

function authorized(req: Request) {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) return null
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// PATCH { code, status: "paid" | "cancelled" | "pending" } — confirms a payment so the order appears in the public feed.
export async function PATCH(req: Request) {
  if (rateLimited(`admin:${clientIp(req)}`, 30, 5 * 60_000)) return Response.json({ error: "too_many_requests" }, { status: 429 })
  const ok = authorized(req)
  if (ok === null) return Response.json({ error: "ADMIN_TOKEN is not configured" }, { status: 503 })
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const code = String(body?.code ?? "")
  const status = String(body?.status ?? "")
  if (!["paid", "cancelled", "pending"].includes(status)) return Response.json({ error: "bad_status" }, { status: 400 })

  const updated = await db
    .update(orders)
    .set({ status, paidAt: status === "paid" ? new Date() : null })
    .where(eq(orders.code, code))
    .returning({ code: orders.code, status: orders.status })
  if (!updated.length) return Response.json({ error: "not_found" }, { status: 404 })
  return Response.json(updated[0])
}
