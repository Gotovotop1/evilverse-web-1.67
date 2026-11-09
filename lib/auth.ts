import { timingSafeEqual } from "node:crypto"

/** Bearer-токен з порівнянням за сталий час. null — змінна оточення не задана. */
export function bearerMatches(req: Request, expected: string | undefined): boolean | null {
  if (!expected) return null
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
