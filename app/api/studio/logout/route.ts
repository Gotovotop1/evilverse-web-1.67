import { pool } from "@/lib/db"
import { handler, json, preflight, sha } from "@/lib/studio/core"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

export const POST = handler(async (req) => {
  const t = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim()
  if (t) await pool.query(`DELETE FROM studio_sessions WHERE token_hash = $1`, [sha(t)])
  return json(req, { ok: true })
})
