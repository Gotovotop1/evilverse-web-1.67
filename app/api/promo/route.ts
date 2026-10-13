import { PROMO } from "@/lib/catalog"
import { clientIp, rateLimited } from "@/lib/server-utils"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  if (rateLimited(`promo:${clientIp(req)}`, 20, 5 * 60_000)) return Response.json({ error: "too_many_requests" }, { status: 429 })
  const body = await req.json().catch(() => null)
  const code = String(body?.code ?? "").trim().toUpperCase()
  if (!(code in PROMO)) return Response.json({ valid: false })
  return Response.json({ valid: true, code, percent: PROMO[code] })
}
