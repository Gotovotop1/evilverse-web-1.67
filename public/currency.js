"use strict";

// Вибір валюти: усі ціни на сайті зберігаються в гривнях (UAH) і конвертуються на льоту.
// Валюта за замовчуванням залежить від мови (uk → UAH, ru → RUB, en → USD),
// доки відвідувач не вибере валюту вручну.
window.EvilCurrency = (() => {
  const CURRENCIES = ["UAH", "RUB", "USD"];
  const LANGUAGE_DEFAULT = { uk: "UAH", ru: "RUB", en: "USD" };
  const FALLBACK_RATES = { UAH: 1, RUB: 1.95, USD: 0.0241 };
  const CHOICE_KEY = "evilverse-currency";
  const RATES_KEY = "evilverse-rates";
  const RATES_TTL = 6 * 60 * 60 * 1000;
  const RATES_URL = "https://open.er-api.com/v6/latest/UAH";
  const LOCALES = { uk: "uk-UA", ru: "ru-RU", en: "en-US" };
  const WORDS = {
    UAH: { uk: "грн", ru: "грн", en: "UAH" },
    RUB: { uk: "руб", ru: "руб", en: "RUB" },
  };

  const select = document.querySelector("#currencySelect");
  const language = () => window.EvilI18n?.language || document.documentElement.lang || "uk";
  const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

  let rates = { ...FALLBACK_RATES };
  let chosen = CURRENCIES.includes(read(CHOICE_KEY)) ? read(CHOICE_KEY) : null;
  let code = chosen || LANGUAGE_DEFAULT[language()] || "UAH";

  const isValidRates = (r) => r && CURRENCIES.every((c) => Number.isFinite(r[c]) && r[c] > 0);

  try {
    const cached = JSON.parse(read(RATES_KEY) || "null");
    if (cached && isValidRates(cached.rates)) rates = { ...cached.rates, UAH: 1 };
  } catch {}

  const announce = () => {
    if (select && select.value !== code) select.value = code;
    document.documentElement.dataset.currency = code;
    document.dispatchEvent(new CustomEvent("evil:currencychange", { detail: code }));
  };

  function format(amountUah, target = code) {
    const value = amountUah * (rates[target] ?? 1);
    if (target === "USD") {
      return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    const rounded = Math.round(value);
    const number = rounded.toLocaleString(LOCALES[language()] || "uk-UA").replace(/[\u00a0\u202f]/g, " ");
    return `${number} ${WORDS[target][language()] || WORDS[target].uk}`;
  }

  function set(next) {
    if (!CURRENCIES.includes(next) || next === code) return;
    code = next;
    chosen = next;
    write(CHOICE_KEY, next);
    announce();
  }

  async function refreshRates() {
    try {
      const cached = JSON.parse(read(RATES_KEY) || "null");
      if (cached && isValidRates(cached.rates) && Date.now() - cached.at < RATES_TTL) return;
    } catch {}
    try {
      const res = await fetch(RATES_URL);
      if (!res.ok) return;
      const data = await res.json();
      const next = { UAH: 1, RUB: data?.rates?.RUB, USD: data?.rates?.USD };
      if (!isValidRates(next)) return;
      rates = next;
      write(RATES_KEY, JSON.stringify({ at: Date.now(), rates: next }));
      announce();
    } catch {}
  }

  select?.addEventListener("change", () => set(select.value));

  document.addEventListener("evil:languagechange", () => {
    if (chosen) return;
    const next = LANGUAGE_DEFAULT[language()] || "UAH";
    if (next !== code) { code = next; announce(); }
  });

  if (select) select.value = code;
  document.documentElement.dataset.currency = code;
  refreshRates();

  return {
    format,
    set,
    get code() { return code; },
    get rates() { return { ...rates }; },
    currencies: CURRENCIES,
  };
})();
