import { env, handler, json, preflight, secretOk } from "@/lib/studio/core"
import { platformConfigured } from "@/lib/studio/platforms"
import { storageMode } from "@/lib/studio/storage"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

/** Что из аккаунтов и автопостинга включено на сервере — студия показывает только то, что работает. */
export async function GET(req: Request) {
  const ready = secretOk() && !!env("DATABASE_URL")
  return json(req, {
    enabled: ready,
    login: {
      google: ready && platformConfigured("youtube"),
      telegram: ready && env("TELEGRAM_BOT_TOKEN") && env("TELEGRAM_LOGIN_BOT") ? env("TELEGRAM_LOGIN_BOT").replace(/^@/, "") : null,
      email: ready && (!!env("RESEND_API_KEY") && !!env("STUDIO_MAIL_FROM") || devCodes()),
    },
    platforms: { tiktok: ready && platformConfigured("tiktok"), youtube: ready && platformConfigured("youtube"), instagram: ready && platformConfigured("instagram") },
    storage: ready ? storageMode() : null,
    review: { tiktok: env("TIKTOK_AUDITED") === "1", youtube: env("YOUTUBE_AUDITED") === "1", instagram: env("INSTAGRAM_APPROVED") === "1" },
  })
}
const devCodes = () => env("STUDIO_DEV_LOGIN_CODES") === "1" && process.env.VERCEL_ENV !== "production"
