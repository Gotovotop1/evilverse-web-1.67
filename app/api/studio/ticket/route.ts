import { authed, createTicket, json, preflight } from "@/lib/studio/core"

export const dynamic = "force-dynamic"
export const OPTIONS = preflight

/** Одноразовый билет на 3 минуты: студия открывает по нему страницу подключения соцсети. */
export const POST = authed(async (req, u) => json(req, { ticket: await createTicket(u.id) }))
