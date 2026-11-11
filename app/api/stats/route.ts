import { bearerMatches } from "@/lib/auth"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { kvGet, kvSet } from "@/lib/kv"
import { NICK_RE } from "@/lib/catalog"

export const dynamic = "force-dynamic"

/*
 * Топи гравців для сайту.
 *   POST /api/stats  ← сервер (HellPrime, токен DELIVERY_TOKEN) раз на 5 хв: { boards: { kills: [{name, value}], ... }, online, max }
 *   GET  /api/stats  → те самі дані + час оновлення (публічно)
 * Дошки беруться з ajLeaderboards (config.yml HellPrime → web-shop.stats-boards).
 */

type Row = { name: string; value: string }

export async function POST(req: Request) {
  const ok = bearerMatches(req, process.env.DELIVERY_TOKEN)
  if (ok === null) return Response.json({ error: "DELIVERY_TOKEN is not configured" }, { status: 503 })
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => null)
  const boards: Record<string, Row[]> = {}
  for (const [key, rows] of Object.entries(body?.boards ?? {}).slice(0, 12)) {
    if (!/^[a-z0-9_]{1,40}$/.test(key) || !Array.isArray(rows)) continue
    boards[key] = rows
      .slice(0, 10)
      .filter((r: any) => NICK_RE.test(String(r?.name ?? "")))
      .map((r: any) => ({ name: String(r.name), value: String(r.value ?? "").slice(0, 32) }))
  }
  const data = {
    boards,
    online: Number.isFinite(Number(body?.online)) ? Number(body.online) : null,
    max: Number.isFinite(Number(body?.max)) ? Number(body.max) : null,
    updatedAt: new Date().toISOString(),
  }
  await ensureDeliveryColumns()
  await kvSet("server_stats", JSON.stringify(data))
  return Response.json({ ok: true })
}

export async function GET() {
  try {
    await ensureDeliveryColumns()
    const raw = await kvGet("server_stats")
    return Response.json(raw ? JSON.parse(raw) : { boards: {}, updatedAt: null }, { headers: { "Cache-Control": "public, max-age=60" } })
  } catch {
    return Response.json({ boards: {}, updatedAt: null })
  }
}
