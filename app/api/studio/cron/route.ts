import { bearerMatches } from "@/lib/auth"
import { env, fail, handler, json } from "@/lib/studio/core"
import { processDue } from "@/lib/studio/worker"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Публикует всё, чьё время пришло. Запускать каждые 5–10 минут:
 *  - Vercel Cron (тариф Pro) — сам шлёт Authorization: Bearer $CRON_SECRET;
 *  - или GitHub Actions / cron-job.org — тот же заголовок.
 */
async function run(req: Request) {
  const ok = bearerMatches(req, env("CRON_SECRET") || undefined)
  if (!ok) return fail(req, ok === null ? "CRON_SECRET не задан" : "Неверный ключ", ok === null ? 503 : 401)
  const res = await processDue({ budgetMs: 50_000 })
  return json(req, { ok: true, ...res })
}
export const GET = handler(run)
export const POST = handler(run)
