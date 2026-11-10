import { kvGet, kvSet } from "@/lib/kv"

// Курс гривні до долара для цін у USDT. Джерело — НБУ, запасне — open.er-api.com; кеш у базі на 6 годин.
const TTL_MS = 6 * 3600_000
const FALLBACK_UAH_PER_USD = 41.5

async function fetchRate(): Promise<number | null> {
  try {
    const res = await fetch("https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json", { cache: "no-store", signal: AbortSignal.timeout(5000) })
    const rate = Number((await res.json())?.[0]?.rate)
    if (rate > 10 && rate < 200) return rate
  } catch {}
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store", signal: AbortSignal.timeout(5000) })
    const rate = Number((await res.json())?.rates?.UAH)
    if (rate > 10 && rate < 200) return rate
  } catch {}
  return null
}

/** Скільки гривень коштує 1 USD (≈ 1 USDT). */
export async function uahPerUsd(): Promise<number> {
  const cached = await kvGet("uah_per_usd").catch(() => null)
  const [at, value] = (cached ?? "").split(" ").map(Number)
  if (value > 0 && Date.now() - at < TTL_MS) return value
  const fresh = await fetchRate()
  if (fresh) {
    await kvSet("uah_per_usd", `${Date.now()} ${fresh}`).catch(() => {})
    return fresh
  }
  return value > 0 ? value : FALLBACK_UAH_PER_USD
}

/** Ціна в USDT (округлення вгору до центів), напр. 55 грн → "1.33". */
export async function uahToUsdt(uah: number) {
  const usdt = Math.ceil((uah / (await uahPerUsd())) * 100) / 100
  return Math.max(usdt, 0.1).toFixed(2)
}

// ── Рублі (для DonatePay) ──────────────────────────────────────────────
const FALLBACK_RUB_PER_UAH = 2.0

/** Скільки рублів коштує 1 гривня. Джерело — open.er-api.com, кеш у базі на 6 годин. */
export async function rubPerUah(): Promise<number> {
  const cached = await kvGet("rub_per_uah").catch(() => null)
  const [at, value] = (cached ?? "").split(" ").map(Number)
  if (value > 0 && Date.now() - at < TTL_MS) return value
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/UAH", { cache: "no-store", signal: AbortSignal.timeout(5000) })
    const rate = Number((await res.json())?.rates?.RUB)
    if (rate > 0.5 && rate < 10) {
      await kvSet("rub_per_uah", `${Date.now()} ${rate}`).catch(() => {})
      return rate
    }
  } catch {}
  return value > 0 ? value : FALLBACK_RUB_PER_UAH
}

/** Ціна в рублях (цілі, вгору). RUB_MARKUP_PERCENT у Vercel — націнка, щоб покрити комісію DonatePay (за замовчуванням 0). */
export async function uahToRub(uah: number) {
  const markup = 1 + Math.max(0, Number(process.env.RUB_MARKUP_PERCENT ?? 0) || 0) / 100
  return Math.max(10, Math.ceil(uah * (await rubPerUah()) * markup))
}

/** Ціна в зірках Telegram. STARS_USD — скільки доларів ти отримуєш за 1 зірку при виведенні (за замовчуванням 0.013). */
export async function uahToStars(uah: number) {
  const perStar = Number(process.env.STARS_USD ?? 0.013) || 0.013
  return Math.max(1, Math.ceil(uah / (await uahPerUsd()) / perStar))
}
