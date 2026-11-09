import { monoJarLink, monoConfigured } from "@/lib/mono"

export const dynamic = "force-dynamic"

// GET /api/pay-config — які автоматичні способи оплати увімкнені (налаштовуються змінними у Vercel).
export function GET() {
  return Response.json(
    { mono: monoConfigured() ? { link: monoJarLink() } : null },
    { headers: { "Cache-Control": "public, max-age=60" } },
  )
}
