import { randomBytes } from "node:crypto"
import { CATALOG, ENABLED_PAYMENTS, NICK_RE, PROMO, THIRTY_DAY_RATE } from "@/lib/catalog"
import { db } from "@/lib/db"
import { orders, type OrderItem } from "@/lib/db/schema"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { clientIp, rateLimited, sendDiscordWebhook } from "@/lib/server-utils"
import { monoConfigured } from "@/lib/mono"
import { uahToUsdt } from "@/lib/rates"
import { uniqueTronAmount } from "@/lib/tron"

export const dynamic = "force-dynamic"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function POST(req: Request) {
  if (rateLimited(`order:${clientIp(req)}`, 8, 10 * 60_000)) return json({ error: "too_many_requests" }, 429)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: "bad_json" }, 400)
  }

  const nick = String(body?.nick ?? "").trim()
  const discord = String(body?.discord ?? "").trim()
  const method = String(body?.method ?? "")
  const promo = body?.promo ? String(body.promo).trim().toUpperCase() : null
  const giftTo = body?.gift?.to ? String(body.gift.to).trim() : null
  const giftMessage = body?.gift?.message ? String(body.gift.message).trim().slice(0, 140) : null

  if (!NICK_RE.test(nick)) return json({ error: "bad_nick" }, 400)
  if (discord.length < 2 || discord.length > 40) return json({ error: "bad_discord" }, 400)
  if (!ENABLED_PAYMENTS.includes(method) && !(method === "mono" && monoConfigured())) return json({ error: "bad_method" }, 400)
  if (giftTo && (!NICK_RE.test(giftTo) || giftTo.toLowerCase() === nick.toLowerCase())) return json({ error: "bad_gift_nick" }, 400)
  if (promo && !(promo in PROMO)) return json({ error: "bad_promo" }, 400)
  if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 20) return json({ error: "bad_items" }, 400)

  const items: OrderItem[] = []
  let rankCount = 0
  let subCount = 0
  for (const raw of body.items) {
    const product = CATALOG[String(raw?.id)]
    const qty = Number(raw?.qty)
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 20) return json({ error: "bad_items" }, 400)
    let unit = product.price
    let dur: OrderItem["dur"] = ""
    if (product.cat === "rank") {
      rankCount++
      if (qty !== 1) return json({ error: "bad_items" }, 400)
      dur = raw?.dur === "30" ? "30" : "forever"
      if (dur === "30") unit = Math.round(product.price * THIRTY_DAY_RATE)
    } else if (product.cat === "sub") {
      subCount++
      if (qty !== 1) return json({ error: "bad_items" }, 400)
      dur = "30"
    }
    items.push({ id: String(raw.id), dur, qty, unit })
  }
  if (rankCount > 1) return json({ error: "one_rank_only" }, 400)
  if (subCount > 1) return json({ error: "one_sub_only" }, 400)

  const subtotal = items.reduce((sum, i) => sum + i.unit * i.qty, 0)
  const discount = promo ? Math.round((subtotal * PROMO[promo]) / 100) : 0
  const total = subtotal - discount

  try {
    await ensureDeliveryColumns()
  } catch {
    return json({ error: "db_error" }, 500)
  }

  // Оплата USDT (TON): фіксуємо суму в USDT за курсом на момент замовлення
  // TRC20 (crypto) — ще й унікальна сума до тисячних: у TRON немає коментаря, платіж впізнаємо за сумою
  const payAmount = method === "ton" ? await uahToUsdt(total)
    : method === "crypto" ? await uniqueTronAmount(await uahToUsdt(total))
    : null

  let code = ""
  for (let attempt = 0; attempt < 5; attempt++) {
    code = `EV-${randomBytes(4).toString("hex").slice(0, 6).toUpperCase()}`
    try {
      await db.insert(orders).values({
        code, nick, discord, method, items, subtotal, discount, total, promo, giftTo, giftMessage, payAmount,
      })
      break
    } catch (error: any) {
      if (error?.code !== "23505" || attempt === 4) return json({ error: "db_error" }, 500)
    }
  }

  const fields = [
    { name: "Нік", value: nick, inline: true },
    { name: "Discord", value: discord, inline: true },
    { name: "Оплата", value: method, inline: true },
    { name: "Товари", value: items.map((i) => `${i.id}${i.dur ? ` (${i.dur})` : ""} ×${i.qty}`).join("\n").slice(0, 1000) },
    { name: "Сума", value: `${total} грн${payAmount ? ` = ${payAmount} USDT` : ""}${promo ? ` (${promo})` : ""}`, inline: true },
  ]
  if (giftTo) fields.push({ name: "Подарунок для", value: `${giftTo}${giftMessage ? `\n${giftMessage}` : ""}`, inline: true })
  void sendDiscordWebhook({ allowed_mentions: { parse: [] }, embeds: [{ title: `Нове замовлення ${code}`, color: 0xff6a00, fields }] })

  return json({ code, nick, discord, method, items, subtotal, discount, total, promo, giftTo, giftMessage, payAmount, createdAt: new Date().toISOString() })
}
