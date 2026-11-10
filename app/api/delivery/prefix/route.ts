import { randomBytes } from "node:crypto"
import { pool } from "@/lib/db"
import { bearerMatches } from "@/lib/auth"
import { normalizePrefix, NICK_RE } from "@/lib/catalog"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { sendDiscordWebhook } from "@/lib/server-utils"

export const dynamic = "force-dynamic"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

/*
 * POST /api/delivery/prefix — бесплатная заявка на личный префикс по подписке (Prime ∞), её шлёт плагин HellPrime
 * по команде /prime prefix <текст>. Доступ — только с DELIVERY_TOKEN.
 * Создаётся «бесплатный» оплаченный заказ с префиксом на проверке: администратор одобряет его в /admin.html,
 * после чего сервер выдаёт префикс как обычный товар. Лимит: одна заявка (одобренная или на проверке)
 * за cooldownDays дней; отклонённые заявки лимит не тратят.
 */
export async function POST(req: Request) {
  const ok = bearerMatches(req, process.env.DELIVERY_TOKEN)
  if (ok === null) return json({ error: "disabled" }, 503)
  if (!ok) return json({ error: "unauthorized" }, 401)
  const body = await req.json().catch(() => null)
  const player = String(body?.player ?? "")
  const text = normalizePrefix(body?.text)
  const cooldownDays = Math.min(365, Math.max(1, Math.floor(Number(body?.cooldownDays) || 30)))
  if (!NICK_RE.test(player)) return json({ error: "bad_player" }, 400)
  if (!text) return json({ error: "bad_text" }, 400)
  await ensureDeliveryColumns()

  const recent = (await pool.query(
    `SELECT prefix_status, created_at FROM orders
     WHERE method = 'free' AND lower(nick) = lower($1) AND prefix_status IN ('pending', 'approved')
       AND created_at > now() - make_interval(days => $2)
     ORDER BY created_at DESC`,
    [player, cooldownDays],
  )).rows
  if (recent.some((r) => r.prefix_status === "pending")) return json({ error: "pending" }, 409)
  if (recent.length) {
    const until = new Date(recent[0].created_at).getTime() + cooldownDays * 86_400_000
    return json({ error: "cooldown", until }, 409)
  }

  let code = ""
  for (let attempt = 0; attempt < 5; attempt++) {
    code = `EV-${randomBytes(4).toString("hex").slice(0, 6).toUpperCase()}`
    try {
      await pool.query(
        `INSERT INTO orders (code, nick, discord, method, items, subtotal, discount, total, status, paid_at, prefix_status)
         VALUES ($1, $2, '—', 'free', $3::jsonb, 0, 0, 0, 'paid', now(), 'pending')`,
        [code, player, JSON.stringify([{ id: "prefix", dur: "", qty: 1, unit: 0, text }])],
      )
      break
    } catch (error: any) {
      if (error?.code !== "23505" || attempt === 4) return json({ error: "db_error" }, 500)
    }
  }
  void sendDiscordWebhook({
    allowed_mentions: { parse: [] },
    embeds: [{ title: `Заявка на префікс (Prime ∞): ${code}`, color: 0xc800ff,
      fields: [{ name: "Гравець", value: player, inline: true }, { name: "Префікс", value: text, inline: true }],
      description: "Схвали або відхили в /admin.html" }],
  })
  return json({ code })
}
