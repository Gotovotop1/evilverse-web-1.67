const hits = new Map<string, number[]>()

export function rateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > limit
}

/**
 * Те саме обмеження, але спільне для всіх копій сайту на Vercel (лічильник у базі, таблиця rate_limits).
 * Спочатку дешева перевірка в пам'яті, потім — у базі. Якщо база недоступна, запит не блокуємо.
 */
export async function rateLimitedShared(key: string, limit: number, windowMs: number) {
  if (rateLimited(key, limit, windowMs)) return true
  try {
    const { pool } = await import("@/lib/db")
    const { ensureDeliveryColumns } = await import("@/lib/db/ensure")
    await ensureDeliveryColumns()
    const r = await pool.query(
      `INSERT INTO rate_limits (key, window_start, hits) VALUES ($1, now(), 1)
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN 1 ELSE rate_limits.hits + 1 END,
         window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN now() ELSE rate_limits.window_start END
       RETURNING hits`,
      [key, windowMs / 1000],
    )
    return Number(r.rows[0]?.hits ?? 0) > limit
  } catch {
    return false
  }
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

export async function sendDiscordWebhook(payload: unknown) {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return false
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}
