import { eq } from "drizzle-orm"
import { randomBytes } from "node:crypto"
import { CATALOG, ENABLED_PAYMENTS, NICK_RE, PROMO, normalizePrefix } from "@/lib/catalog"
import { db } from "@/lib/db"
import { orders, type OrderItem } from "@/lib/db/schema"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { clientIp, rateLimited, sendDiscordWebhook } from "@/lib/server-utils"
import { monoConfigured } from "@/lib/mono"
import { uahToRub, uahToStars, uahToUsdt } from "@/lib/rates"
import { donatepayConfigured, donatepayLink } from "@/lib/donatepay"
import { createStarsInvoice, ensureWebhook, starsConfigured } from "@/lib/stars"
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
  const autoMethods: Record<string, () => boolean> = { mono: monoConfigured, donatepay: donatepayConfigured, stars: starsConfigured }
  if (!ENABLED_PAYMENTS.includes(method) && !autoMethods[method]?.()) return json({ error: "bad_method" }, 400)
  if (giftTo && (!NICK_RE.test(giftTo) || giftTo.toLowerCase() === nick.toLowerCase())) return json({ error: "bad_gift_nick" }, 400)
  if (promo && !(promo in PROMO)) return json({ error: "bad_promo" }, 400)
  if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 20) return json({ error: "bad_items" }, 400)

  const items: OrderItem[] = []
  let subCount = 0
  let prefixCount = 0
  for (const raw of body.items) {
    const product = CATALOG[String(raw?.id)]
    const qty = Number(raw?.qty)
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 20) return json({ error: "bad_items" }, 400)
    const item: OrderItem = { id: String(raw.id), dur: "", qty, unit: product.price }
    if (product.cat === "sub") {
      subCount++
      if (qty !== 1) return json({ error: "bad_items" }, 400)
      item.dur = "30"
    }
    if (item.id === "prefix") {
      prefixCount++
      const text = normalizePrefix(raw?.text)
      if (qty !== 1 || !text) return json({ error: "bad_prefix" }, 400)
      item.text = text
    }
    items.push(item)
  }
  if (subCount > 1) return json({ error: "one_sub_only" }, 400)
  if (prefixCount > 1) return json({ error: "one_prefix_only" }, 400)

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
    : method === "donatepay" ? String(await uahToRub(total))
    : method === "stars" ? String(await uahToStars(total))
    : null
  const payUnit = method === "donatepay" ? "₽" : method === "stars" ? "⭐" : "USDT"

  let code = ""
  for (let attempt = 0; attempt < 5; attempt++) {
    code = `EV-${randomBytes(4).toString("hex").slice(0, 6).toUpperCase()}`
    try {
      await db.insert(orders).values({
        code, nick, discord, method, items, subtotal, discount, total, promo, giftTo, giftMessage, payAmount,
        prefixStatus: prefixCount ? "pending" : null,
      })
      break
    } catch (error: any) {
      if (error?.code !== "23505" || attempt === 4) return json({ error: "db_error" }, 500)
    }
  }

  // Посилання на оплату: DonatePay — сторінка з сумою й кодом; Stars — рахунок Telegram
  let payLink: string | null = null
  try {
    if (method === "donatepay") payLink = donatepayLink(Number(payAmount), code)
    if (method === "stars") {
      // Вебхук — лише на основний (production) домен: превʼю-адреси Vercel закриті паролем, Telegram туди не достукається
      const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || req.headers.get("x-forwarded-host") || req.headers.get("host")
      if (host && process.env.VERCEL_ENV !== "preview") await ensureWebhook(`https://${host}`)
      const itemsText = items.map((i) => `${i.id}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ")
      payLink = await createStarsInvoice(code, Number(payAmount), itemsText)
    }
  } catch (error) {
    console.error("[order pay link]", error)
    await db.update(orders).set({ status: "cancelled" }).where(eq(orders.code, code))
    return json({ error: "pay_unavailable" }, 502)
  }
  if (payLink) await db.update(orders).set({ payLink }).where(eq(orders.code, code))

  const fields = [
    { name: "Нік", value: nick, inline: true },
    { name: "Discord", value: discord, inline: true },
    { name: "Оплата", value: method, inline: true },
    { name: "Товари", value: items.map((i) => `${i.id}${i.dur ? ` (${i.dur})` : ""} ×${i.qty}${i.text ? ` «${i.text}»` : ""}`).join("\n").slice(0, 1000) },
    { name: "Сума", value: `${total} грн${payAmount ? ` = ${payAmount} ${payUnit}` : ""}${promo ? ` (${promo})` : ""}`, inline: true },
  ]
  if (giftTo) fields.push({ name: "Подарунок для", value: `${giftTo}${giftMessage ? `\n${giftMessage}` : ""}`, inline: true })
  void sendDiscordWebhook({ allowed_mentions: { parse: [] }, embeds: [{ title: `Нове замовлення ${code}`, color: 0xff6a00, fields }] })

  return json({ code, nick, discord, method, items, subtotal, discount, total, promo, giftTo, giftMessage, payAmount, payLink, createdAt: new Date().toISOString() })
}
