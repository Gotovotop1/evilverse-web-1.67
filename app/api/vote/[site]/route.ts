import { acceptVote } from "@/lib/votes"

export const dynamic = "force-dynamic"

/*
 * Сюди моніторинги надсилають голоси: https://<сайт>/api/vote/<hotmc|mctop|topcraft|minecraftrating|mineserv>
 * (адреса «скрипта поощрения» в кабінеті моніторингу). Приймаємо і GET, і POST (форма або JSON).
 * Відповідь "ok" — голос прийнято (або вже був сьогодні — щоб моніторинг не повторював).
 */

async function readParams(req: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  new URL(req.url).searchParams.forEach((v, k) => { out[k] = v })
  if (req.method === "POST") {
    const type = req.headers.get("content-type") ?? ""
    try {
      if (type.includes("application/json")) {
        const body = await req.json()
        if (body && typeof body === "object") for (const [k, v] of Object.entries(body)) out[k] = String(v)
      } else {
        const form = await req.formData()
        form.forEach((v, k) => { if (typeof v === "string") out[k] = v })
      }
    } catch {}
  }
  for (const k of Object.keys(out)) out[k] = out[k].trim().slice(0, 200)
  return out
}

async function handle(req: Request, ctx: { params: Promise<{ site: string }> }) {
  const { site } = await ctx.params
  const params = await readParams(req)
  let result
  try {
    result = await acceptVote(site, params)
  } catch (error) {
    console.error("[vote]", site, error)
    return new Response("error", { status: 500 })
  }
  if (result === "ok" || result === "duplicate") return new Response("ok", { status: 200 })
  console.warn("[vote] rejected", site, result)
  const status = result === "unknown_site" ? 404 : result === "not_configured" ? 503 : 400
  return new Response(result, { status })
}

export const GET = handle
export const POST = handle
