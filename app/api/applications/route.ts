import { NICK_RE } from "@/lib/catalog"
import { clientIp, rateLimited, sendDiscordWebhook } from "@/lib/server-utils"

export const dynamic = "force-dynamic"

/*
 * Заявки на роли → посты в форумах Discord (по форуму на роль).
 *   DISCORD_APP_WEBHOOK_HELPER / _MEDIA / _CODER / _MODER — вебхук, созданный в форуме этой роли
 *   DISCORD_APP_WEBHOOK — запасной форум (или канал) для ролей без своего вебхука
 * Если ничего не задано — как раньше, сообщением в DISCORD_WEBHOOK_URL.
 * Каждая заявка — отдельный пост «Ник · APP-XXXX» в форуме, внутри — все ответы.
 */

const MIN_AGE: Record<string, number> = { moder: 15, helper: 14, media: 13, coder: 14 }
const COLORS: Record<string, number> = { moder: 0xff3b2f, helper: 0xff9a3c, media: 0xb04aff, coder: 0x3ee0c0 }
const NAMES: Record<string, string> = { moder: "Модератор", helper: "Хелпер", media: "Медиа", coder: "Кодер" }
const ICONS: Record<string, string> = { moder: "🛡️", helper: "🧡", media: "🎬", coder: "💻" }

type Field = { label: string; value: string; long?: boolean }

const webhookFor = (role: string) =>
  (process.env[`DISCORD_APP_WEBHOOK_${role.toUpperCase()}`] || process.env.DISCORD_APP_WEBHOOK || "").trim()

/** Новый пост в форуме через вебхук (thread_name). Если вебхук не в форуме — обычным сообщением. */
async function postToForum(url: string, threadName: string, payload: Record<string, unknown>) {
  if (!/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url)) return false
  const send = (body: Record<string, unknown>) =>
    fetch(`${url}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
  try {
    let res = await send({ ...payload, thread_name: threadName })
    // 220001/220003 и т.п. — вебхук стоит не в форуме: thread_name там нельзя
    if (res.status === 400) res = await send(payload)
    return res.ok
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  if (rateLimited(`app:${clientIp(req)}`, 5, 60 * 60_000)) return Response.json({ error: "too_many_requests" }, { status: 429 })

  const body = await req.json().catch(() => null)
  const role = String(body?.role ?? "")
  const code = String(body?.code ?? "").replace(/[^\w-]/g, "").slice(0, 24)
  const fields: Field[] = Array.isArray(body?.fields) ? body.fields.slice(0, 25) : []
  const values = body?.values ?? {}

  if (!(role in MIN_AGE) || !code) return Response.json({ error: "bad_role" }, { status: 400 })
  const nick = String(values.nick ?? "")
  if (!NICK_RE.test(nick)) return Response.json({ error: "bad_nick" }, { status: 400 })
  if (!/^\d{17,20}$/.test(String(values.discordId ?? ""))) return Response.json({ error: "bad_discord_id" }, { status: 400 })
  const age = Number(values.age)
  if (!Number.isFinite(age) || age < MIN_AGE[role] || age > 60) return Response.json({ error: "bad_age" }, { status: 400 })
  if (!fields.length) return Response.json({ error: "empty" }, { status: 400 })

  const embed = {
    title: `${ICONS[role]} Заявка на ${NAMES[role]} · ${code}`,
    color: COLORS[role],
    fields: fields.map((f) => ({
      name: String(f.label).slice(0, 250) || "—",
      value: String(f.value).slice(0, 1000) || "—",
      inline: !f.long,
    })),
    footer: { text: "Подано с сайта EvilVerse" },
    timestamp: new Date().toISOString(),
  }
  const payload = {
    username: "EvilVerse · Заявки",
    allowed_mentions: { parse: [] },
    content: `<@${values.discordId}> подал(а) заявку на **${NAMES[role]}** · ник \`${nick}\` · ${age} лет`,
    embeds: [embed],
  }

  const forum = webhookFor(role)
  const sent = forum
    ? await postToForum(forum, `${ICONS[role]} ${nick} · ${code}`.slice(0, 100), payload)
    : await sendDiscordWebhook(payload)
  return Response.json({ sent })
}
