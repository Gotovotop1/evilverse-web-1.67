import { bearerMatches } from "@/lib/auth"
import { acceptServerVote } from "@/lib/votes"

export const dynamic = "force-dynamic"

/*
 * Голоси з Votifier: сервер (плагін EvilVotes) приймає голос від моніторингу і пересилає сюди.
 *   POST /api/vote/server  { service, username }  — токен DELIVERY_TOKEN (той самий, що для автовидачі)
 * Далі все як для звичайних голосів: один голос з моніторингу на нік за добу, нагорода через автовидачу.
 * Важливо: /api/vote/[site] — це інший маршрут (для моніторингів з HTTP-скриптом); "server" сюди не потрапляє.
 */
export async function POST(req: Request) {
  const ok = bearerMatches(req, process.env.DELIVERY_TOKEN)
  if (ok === null) return Response.json({ error: "DELIVERY_TOKEN is not configured" }, { status: 503 })
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => null)
  const service = String(body?.service ?? "").trim().slice(0, 60)
  const username = String(body?.username ?? "").trim()
  try {
    const result = await acceptServerVote(service, username)
    return Response.json({ result }, { status: result === "ok" || result === "duplicate" ? 200 : 400 })
  } catch (error) {
    console.error("[vote server]", error)
    return Response.json({ error: "db_error" }, { status: 500 })
  }
}
