import { monoJarLink, monoConfigured } from "@/lib/mono"
import { TON_WALLET, USDT_TON_MASTER, tonConfigured } from "@/lib/ton"
import { TRON_WALLET, tronConfigured } from "@/lib/tron"

export const dynamic = "force-dynamic"

// GET /api/pay-config — які автоматичні способи оплати увімкнені (налаштовуються змінними у Vercel).
export function GET() {
  return Response.json(
    {
      mono: monoConfigured() ? { link: monoJarLink() } : null,
      ton: tonConfigured() ? { wallet: TON_WALLET, jetton: USDT_TON_MASTER } : null,
      tron: tronConfigured() ? { wallet: TRON_WALLET } : null,
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  )
}
