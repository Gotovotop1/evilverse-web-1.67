// Authoritative prices (UAH). Display data lives in public/index.js — keep ids and prices in sync.
// Привілеї прибрано: монетизація — лише підписки HellPrime (Prime / Prime+ / Prime ∞).
export type Category = "sub" | "tokens" | "case" | "extra"

export const CATALOG: Record<string, { cat: Category; price: number }> = {
  // Підписки HellPrime (30 днів)
  prime: { cat: "sub", price: 77 },
  prime_plus: { cat: "sub", price: 111 },
  prime_inf: { cat: "sub", price: 144 },
  t100: { cat: "tokens", price: 20 },
  t300: { cat: "tokens", price: 55 },
  t600: { cat: "tokens", price: 99 },
  t1200: { cat: "tokens", price: 189 },
  t3000: { cat: "tokens", price: 449 },
  c_subs: { cat: "case", price: 99 },
  c_titles: { cat: "case", price: 59 },
  c_xp: { cat: "case", price: 39 },
  unmute: { cat: "extra", price: 49 },
  unban: { cat: "extra", price: 149 },
  prefix: { cat: "extra", price: 79 },
}

export const PROMO: Record<string, number> = { EVIL10: 10, START15: 15, HELL20: 20 }

export const ENABLED_PAYMENTS = ["privat", "crypto", "ton"]

export const NICK_RE = /^[A-Za-z0-9_]{3,16}$/

/** Текст личного префикса: до 10 символов, только буквы, цифры, пробел, «_» и «-» (как в плагине HellPrime). */
export const PREFIX_RE = /^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ0-9_\- ]{1,10}$/

export function normalizePrefix(raw: unknown): string | null {
  const text = String(raw ?? "")
  if (/[\u0000-\u001f\u007f]/.test(text)) return null
  const value = text.trim().replace(/ +/g, " ")
  return PREFIX_RE.test(value) && /[A-Za-zА-Яа-яЁёІіЇїЄєҐґ0-9]/.test(value) ? value : null
}
