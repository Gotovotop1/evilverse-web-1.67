// Authoritative prices (UAH). Display data lives in public/index.js — keep ids and prices in sync.
export type Category = "sub" | "rank" | "tokens" | "case" | "extra"

export const CATALOG: Record<string, { cat: Category; price: number }> = {
  // Підписки HellPrime (30 днів)
  prime: { cat: "sub", price: 55 },
  prime_plus: { cat: "sub", price: 77 },
  bis: { cat: "rank", price: 39 },
  prizrak: { cat: "rank", price: 79 },
  cerber: { cat: "rank", price: 129 },
  zhnets: { cat: "rank", price: 199 },
  demon: { cat: "rank", price: 299 },
  arhidemon: { cat: "rank", price: 449 },
  vladyka: { cat: "rank", price: 699 },
  bezodnya: { cat: "rank", price: 999 },
  t100: { cat: "tokens", price: 20 },
  t300: { cat: "tokens", price: 55 },
  t600: { cat: "tokens", price: 99 },
  t1200: { cat: "tokens", price: 189 },
  t3000: { cat: "tokens", price: 449 },
  c_ranks: { cat: "case", price: 99 },
  c_titles: { cat: "case", price: 59 },
  c_xp: { cat: "case", price: 39 },
  unmute: { cat: "extra", price: 49 },
  unban: { cat: "extra", price: 149 },
  nickcolor: { cat: "extra", price: 39 },
  prefix: { cat: "extra", price: 79 },
}

export const PROMO: Record<string, number> = { EVIL10: 10, START15: 15, HELL20: 20 }

export const THIRTY_DAY_RATE = 0.4

export const ENABLED_PAYMENTS = ["privat", "crypto", "ton"]

export const NICK_RE = /^[A-Za-z0-9_]{3,16}$/
