import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { orders } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const recent = await db
      .select({
        nick: orders.nick,
        giftTo: orders.giftTo,
        items: orders.items,
        at: sql<string>`coalesce(${orders.paidAt}, ${orders.createdAt})`,
      })
      .from(orders)
      .where(eq(orders.status, "paid"))
      .orderBy(desc(sql`coalesce(${orders.paidAt}, ${orders.createdAt})`))
      .limit(8)

    const top = await db
      .select({
        nick: orders.nick,
        total: sql<number>`sum(${orders.total})::int`,
        purchases: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(eq(orders.status, "paid"))
      .groupBy(orders.nick)
      .orderBy(desc(sql`sum(${orders.total})`))
      .limit(5)

    return Response.json(
      {
        recent: recent.map((r) => ({
          nick: r.nick,
          giftTo: r.giftTo,
          at: r.at,
          items: r.items.map((i) => ({ id: i.id, dur: i.dur, qty: i.qty })),
        })),
        top,
      },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
    )
  } catch {
    return Response.json({ recent: [], top: [] }, { status: 200 })
  }
}
