import { NICK_RE } from "@/lib/catalog"
import { clientIp, rateLimitedShared } from "@/lib/server-utils"

export const dynamic = "force-dynamic"

/*
 * Заявки на роли → посты в форумах Discord (по форуму на роль).
 *   DISCORD_APP_WEBHOOK_HELPER / _MEDIA / _CODER / _MODER — вебхук, созданный в форуме этой роли
 *   DISCORD_APP_WEBHOOK — запасной форум (или канал) для ролей без своего вебхука
 * Если ничего не задано — как раньше, сообщениями в DISCORD_WEBHOOK_URL.
 * Каждая заявка — отдельный пост «Ник · APP-XXXX» в форуме, внутри — все ответы (длинные — в несколько сообщений).
 */

const MIN_AGE: Record<string, number> = { moder: 15, helper: 14, media: 13, coder: 14 }
const COLORS: Record<string, number> = { moder: 0xff3b2f, helper: 0xff9a3c, media: 0xb04aff, coder: 0x3ee0c0 }
const NAMES: Record<string, string> = { moder: "Модератор", helper: "Хелпер", media: "Медиа", coder: "Кодер" }
const ICONS: Record<string, string> = { moder: "🛡️", helper: "🧡", media: "🎬", coder: "💻" }

type Field = { label: string; value: string; long?: boolean }

const webhookFor = (role: string) =>
  (process.env[`DISCORD_APP_WEBHOOK_${role.toUpperCase()}`] || process.env.DISCORD_APP_WEBHOOK || "").trim()

const WEBHOOK_RE = /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/

/**
 * Discord принимает в одном сообщении не больше 6000 символов во всех embed и 25 полей.
 * Длинную заявку режем на части: первая создаёт пост в форуме, остальные дописываются в этот же пост.
 */
function chunkFields(fields: { name: string; value: string; inline: boolean }[]) {
  const BUDGET = 5000
  const chunks: (typeof fields)[] = [[]]
  let size = 0
  for (const f of fields) {
    const len = f.name.length + f.value.length
    const cur = chunks[chunks.length - 1]
    if (cur.length && (size + len > BUDGET || cur.length >= 25)) {
      chunks.push([])
      size = 0
    }
    chunks[chunks.length - 1].push(f)
    size += len
  }
  return chunks
}

/** Новый пост в форуме через вебхук (thread_name). Если вебхук не в форуме — обычными сообщениями в канал. */
async function postApplication(url: string, threadName: string, first: Record<string, unknown>, rest: Record<string, unknown>[]) {
  if (!WEBHOOK_RE.test(url)) return false
  const send = (body: Record<string, unknown>, threadId?: string) =>
    fetch(`${url}?wait=true${threadId ? `&thread_id=${threadId}` : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
  try {
    let inForum = true
    let res = await send({ ...first, thread_name: threadName })
    // 220001/220003 и т.п. — вебхук стоит не в форуме: thread_name там нельзя
    if (res.status === 400) {
      inForum = false
      res = await send(first)
    }
    if (!res.ok) {
      console.error("application webhook failed", res.status, (await res.text().catch(() => "")).slice(0, 300))
      return false
    }
    const msg = await res.json().catch(() => ({}))
    const threadId = inForum && /^\d+$/.test(String(msg?.channel_id ?? "")) ? String(msg.channel_id) : undefined
    for (const body of rest) {
      const r = await send(body, threadId)
      if (!r.ok) console.error("application webhook (part) failed", r.status, (await r.text().catch(() => "")).slice(0, 300))
    }
    return true
  } catch (e) {
    console.error("application webhook error", e)
    return false
  }
}

export async function POST(req: Request) {
  if (await rateLimitedShared(`app:${clientIp(req)}`, 5, 60 * 60_000)) return Response.json({ error: "too_many_requests" }, { status: 429 })

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

  // поле embed — до 1024 символов: длинный ответ не обрезаем, а переносим в «(продовження)»
  const embedFields = fields.flatMap((f) => {
    const name = String(f.label).slice(0, 200) || "—"
    const value = String(f.value).slice(0, 3000) || "—"
    const parts = value.match(/[\s\S]{1,1000}/g) ?? ["—"]
    return parts.map((part, i) => ({ name: i ? `${name} (продовження)` : name, value: part, inline: !f.long && parts.length === 1 }))
  })
  const chunks = chunkFields(embedFields)
  const title = `${ICONS[role]} Заявка на ${NAMES[role]} · ${code}`
  const base = { username: "EvilVerse · Заявки", allowed_mentions: { parse: [] } }
  const embeds = chunks.map((part, i) => ({
    title: chunks.length > 1 ? `${title} (${i + 1}/${chunks.length})` : title,
    color: COLORS[role],
    fields: part,
    ...(i === chunks.length - 1 ? { footer: { text: "Подано с сайта EvilVerse" }, timestamp: new Date().toISOString() } : {}),
  }))
  const first = {
    ...base,
    content: `<@${values.discordId}> подал(а) заявку на **${NAMES[role]}** · ник \`${nick}\` · ${age} лет`,
    embeds: [embeds[0]],
  }
  const rest = embeds.slice(1).map((e) => ({ ...base, embeds: [e] }))

  const url = webhookFor(role) || (process.env.DISCORD_WEBHOOK_URL || "").trim()
  const sent = url ? await postApplication(url, `${ICONS[role]} ${nick} · ${code}`.slice(0, 100), first, rest) : false
  return Response.json({ sent })
}
