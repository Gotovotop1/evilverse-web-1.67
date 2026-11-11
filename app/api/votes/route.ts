import { topVoters } from "@/lib/votes"

export const dynamic = "force-dynamic"

// Публічний топ голосуючих за місяць (для сайту)
export async function GET() {
  try {
    return Response.json(await topVoters(10), { headers: { "Cache-Control": "public, max-age=60" } })
  } catch {
    return Response.json({ month: null, top: [] })
  }
}
