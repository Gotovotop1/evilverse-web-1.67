import { NICK_RE } from "@/lib/catalog"
import { clientIp, rateLimited, sendDiscordWebhook } from "@/lib/server-utils"

export const dynamic = "force-dynamic"

const MIN_AGE: Record<string, number> = { moder: 15, helper: 14, media: 13, coder: 14 }
const COLORS: Record<string, number> = { moder: 0xff3b2f, helper: 0xff9a3c, media: 0xb04aff, coder: 0x3ee0c0 }

type Field = { label: string; value: string; long?: boolean }

export async function POST(req: Request) {
  if (rateLimited(`app:${clientIp(req)}`, 5, 60 * 60_000)) return Response.json({ error: "too_many_requests" }, { status: 429 })

  const body = await req.json().catch(() => null)
  const role = String(body?.role ?? "")
  const code = String(body?.code ?? "").slice(0, 24)
  const fields: Field[] = Array.isArray(body?.fields) ? body.fields.slice(0, 25) : []
  const values = body?.values ?? {}

  if (!(role in MIN_AGE) || !code) return Response.json({ error: "bad_role" }, { status: 400 })
  if (!NICK_RE.test(String(values.nick ?? ""))) return Response.json({ error: "bad_nick" }, { status: 400 })
  if (!/^\d{17,20}$/.test(String(values.discordId ?? ""))) return Response.json({ error: "bad_discord_id" }, { status: 400 })
  const age = Number(values.age)
  if (!Number.isFinite(age) || age < MIN_AGE[role] || age > 60) return Response.json({ error: "bad_age" }, { status: 400 })
  if (!fields.length) return Response.json({ error: "empty" }, { status: 400 })

  const sent = await sendDiscordWebhook({
    allowed_mentions: { parse: [] },
    content: `<@${values.discordId}> подав заявку`,
    embeds: [
      {
        title: `Заявка на ${role} · ${code}`,
        color: COLORS[role],
        fields: fields.map((f) => ({
          name: String(f.label).slice(0, 250),
          value: String(f.value).slice(0, 1000) || "—",
          inline: !f.long,
        })),
      },
    ],
  })
  return Response.json({ sent })
}
