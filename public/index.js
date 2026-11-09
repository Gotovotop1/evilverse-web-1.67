"use strict";

/* =========================================================
   НАЛАШТУВАННЯ — заміни реквізити на свої
   ========================================================= */
const CONFIG = {
  IP: "evilverse.tkmc.net",
  DISCORD: "https://discord.gg/8eHG2YsePC",
  DISCORD_CODE: "8eHG2YsePC",
  VERSIONS: "1.8 – 26.2",
  PAYMENTS: {
    // Усі способи показуються завжди, незалежно від мови. available: false — спосіб видно, але вибрати не можна.
    privat: { name: "ПриватБанк", short: "Карта Приват", note: "Переказ на карту", currency: "UAH", details: "5168 7521 1703 7047" },
    crypto: { name: "Крипта USDT (TRC20)", short: "USDT", note: "Без комісії банку", currency: "USDT", details: "TD3okxejs9zbeMELTBusYBeeXCUYZkndhE" },
    mono: { name: "Monobank", short: "Карта Mono", note: "Переказ на карту / банку", currency: "UAH", details: "Банка: https://send.monobank.ua/ (вкажи свою)", available: false, status: "В розробці" },
    casebal: { name: "Депозит Case Bal", short: "Case Bal", note: "Поповнення балансом / депозит-кодом", currency: "UAH", details: "Нік адміна для передачі: EvilverseAdmin", available: false, status: "В розробці" },
    sbp: { name: "СБП", short: "СБП", note: "Переказ за номером телефону", currency: "RUB", details: "—", available: false, status: "Тимчасово недоступно" },
    rucard: { name: "Картка РФ", short: "Картка РФ", note: "Переказ на карту російського банку", currency: "RUB", details: "—", available: false, status: "Тимчасово недоступно" },
  },
  TOKEN_RATE: 5, // 1 грн = 5 фішок (для оплати привілеїв фішками)
};

// Автоматичні способи оплати вмикаються на сервері (monobank — змінні MONO_TOKEN і MONO_JAR у Vercel;
// гаманці USDT — у lib/ton.ts і lib/tron.ts). Порядок: спершу автоматичні, потім недоступні, у самому низу — запасні.
fetch("/api/pay-config").then((r) => (r.ok ? r.json() : null)).then((cfg) => {
  if (!cfg?.mono?.link && !cfg?.ton?.wallet && !cfg?.tron?.wallet) return;
  const { mono, privat, crypto, ...rest } = CONFIG.PAYMENTS;
  const auto = {};
  if (cfg.mono?.link) auto.mono = { ...mono, name: "Будь-яка картка (UAH)", short: "Картка", note: "Visa / Mastercard, Apple Pay, Google Pay · зараховується автоматично", details: cfg.mono.link, available: true, status: "", auto: true };
  if (cfg.ton?.wallet) auto.ton = { name: "Крипта USDT (TON)", short: "USDT TON", note: "Telegram Wallet, Tonkeeper · комісія ~0.03$ · зараховується автоматично", currency: "USDT", details: cfg.ton.wallet, jetton: cfg.ton.jetton, auto: true };
  if (cfg.tron?.wallet) auto.crypto = { ...crypto, name: "Крипта USDT (TRC20)", short: "USDT TRC20", note: "Binance, Trust Wallet, біржі · комісія мережі ~1–3$ · зараховується автоматично", details: cfg.tron.wallet, auto: true };
  CONFIG.PAYMENTS = {
    ...auto,
    ...(auto.mono ? {} : { mono }),
    ...rest,
    ...(auto.crypto ? {} : { crypto }),
    privat: auto.mono ? { ...privat, name: "ПриватБанк (запасний)", note: "Якщо основний спосіб не працює · переказ на карту, підтвердження вручну" } : privat,
  };
}).catch(() => {});

/* =========================================================
   ДАНІ МАГАЗИНУ
   ========================================================= */
const RANKS = [
  { id: "bis", name: "Біс", color: "#c9a27e", price: 39, icon: "Б", desc: "Перший крок у пекло.",
    perks: ["Префікс [Біс] у чаті", "3 точки дому (/sethome)", "5 слотів аукціону", "/hat — блок на голову"] },
  { id: "prizrak", name: "Привид", color: "#9fb3c8", price: 79, icon: "П", desc: "Тебе бачать, але не чують.",
    perks: ["Префікс [Привид]", "/workbench — верстак у кишені", "4 точки дому", "6 слотів аукціону", "Кольоровий текст у чаті"] },
  { id: "cerber", name: "Цербер", color: "#ff9a3c", price: 129, icon: "Ц", popular: true, desc: "Триголовий страж воріт пекла.",
    perks: ["Префікс [Цербер]", "/ec — ендер-скриня", "/feed раз на 10 хв", "4 точки дому", "7 слотів аукціону", "Вхід на повний сервер"] },
  { id: "zhnets", name: "Жнець", color: "#b04aff", price: 199, icon: "Ж", desc: "Збирає душі тих, хто програв.",
    perks: ["Префікс [Жнець]", "/heal раз на 10 хв", "/repair — ремонт предмета", "5 точок дому", "8 слотів аукціону", "+1 кейс щотижня"] },
  { id: "demon", name: "Демон", color: "#ff3b2f", price: 299, icon: "Д", hot: true, desc: "Справжня сила пекельного полум'я.",
    perks: ["Префікс [Демон] з анімацією", "/fly у лобі та на своєму регіоні", "/anvil, /stonecutter", "5 точок дому", "10 слотів аукціону", "Знижка 10% на кейси"] },
  { id: "arhidemon", name: "Архідемон", color: "#ff1a5c", price: 449, icon: "А", desc: "Командує легіонами демонів.",
    perks: ["Префікс [Архідемон]", "/top — телепорт вгору", "6 точок дому", "12 слотів аукціону", "Свій колір ніку", "Знижка 10% на кейси"] },
  { id: "vladyka", name: "Владика", color: "#ffd23f", price: 699, icon: "В", desc: "Правитель усього EVILVERSE.",
    perks: ["Префікс [Владика] з градієнтом", "/back після смерті", "/ptime, /pweather", "7 точок дому", "15 слотів аукціону", "Приватний канал у Discord", "Знижка 20% на кейси"] },
  { id: "bezodnya", name: "Безодня", color: "#ff5500", price: 999, icon: "∞", desc: "Абсолютне зло. Лімітований привілей.",
    perks: ["Кастомний префікс на вибір", "/god на івентах для глядачів", "/back після смерті", "/near — гравці поруч", "8 точок дому", "18 слотів аукціону", "Особиста роль та колір у Discord", "Пріоритетна підтримка", "Знижка 25% на кейси", "Голос у розвитку сервера"] },
];

const TOKEN_PACKS = [
  { id: "t100", amount: 100, bonus: 0, price: 20 },
  { id: "t300", amount: 300, bonus: 30, price: 55 },
  { id: "t600", amount: 600, bonus: 90, price: 99, popular: true },
  { id: "t1200", amount: 1200, bonus: 240, price: 189 },
  { id: "t3000", amount: 3000, bonus: 900, price: 449, hot: true },
];

// Підписки Prime (плагін HellPrime). Ціни на сайті — у гривнях; у грі ті самі підписки продаються за фішки (/prime).
const SUBS = [
  { id: "prime", name: "Prime", color: "#ffa31a", price: 55, ingame: 449, icon: "P",
    desc: "Зручності та косметика на 30 днів. Жодних переваг у бою.",
    perks: ["5 точок дому", "+1 слот аукціону", "/hat — блок на голову", "Кольоровий нік /nick", "Аура з частинок (2 стилі)",
      "Титули (2) у чаті та TAB", "Оголошення про вхід", "Пози /lay та /bellyflop", "Своя погода /pweather",
      "Ефект убивства (2 види)", "Бан після смерті коротший на 25%"] },
  { id: "prime_plus", name: "Prime+", color: "#ff3b1a", price: 77, ingame: 599, icon: "P+", hot: true,
    desc: "Усе з Prime, але більше та яскравіше. 30 днів.",
    perks: ["Усе з Prime", "8 точок дому", "+5 слотів аукціону", "/craft — верстак у кишені", "Аура Пекла (5 стилів)",
      "Титули Prime+ (5)", "Явлення Prime+ — вхід зі звуком", "Вхід на повний сервер", "Пози /spin та /crawl",
      "Свій час доби /ptime", "Автоприйняття телепорту /tpauto", "Ефекти убивства (6 видів)", "Слід за стрілами та тризубом",
      "Бан після смерті коротший на 50%"] },
];

const CASES = [
  { id: "c_xp", name: "Кейс Досвіду", color: "#5df24c", price: 39, icon: "К", desc: "Досвід — валюта нашої економіки. Головний приз — 100 000.",
    perks: ["Від 500 до 100 000 досвіду", "Досвід — основна валюта сервера", "Джекпот 100 000 — шанс 1%", "Видається одразу на баланс"] },
  { id: "c_titles", name: "Кейс Титулів", color: "#ff4fa3", price: 59, icon: "К", desc: "Усі 18 унікальних титулів сервера з кольоровими градієнтами.",
    perks: ["18 титулів, які вже є на сервері", "Титул залишається назавжди", "Рідкісні титули — з шансом від 1%", "Кожен титул — свій колір і градієнт у чаті"] },
  { id: "c_ranks", name: "Кейс Привілегій", color: "#ffd23f", price: 99, icon: "К", desc: "Усі 8 привілеїв сервера: випадають на 30 днів або назавжди.",
    perks: ["Усі 8 привілеїв — від Біса до Безодні", "Випадають і на 30 днів, і назавжди", "Безодня назавжди — шанс 0.5%", "Чим вищий привілей, тим рідше випадає"] },
];

const RARITY = {
  common: { name: "Звичайні", color: "#9fb3c8" },
  rare: { name: "Рідкісні", color: "#4aa3ff" },
  epic: { name: "Епічні", color: "#b04aff" },
  legendary: { name: "Легендарні", color: "#ffd23f" },
};

const CASE_THEME = {
  c_xp: {
    className: "loot--xp",
    accent: "#5df24c",
    rarity: { common: "#8fd17a", rare: "#3fe06a", epic: "#19e6a8", legendary: "#d6ff3a" },
  },
};
const rarityColor = (caseId, key) => CASE_THEME[caseId]?.rarity[key] ?? RARITY[key].color;

/* Титули в форматі MiniMessage (як у плагіні): <#hex>, <gradient:#a:#b>…</gradient>, <bold> ігнорується. */
const TITLES = [
  ["<gradient:#ffe259:#ffa751>сын миража</gradient>", "common", 8],
  ["<#222222>по<#ff0000>ᴍᴏɢɢ<#222222>у", "common", 8],
  ["<gradient:#f7971e:#ffd200>казинак</gradient>", "common", 9],
  ["<gradient:#ff0844:#ffb199>го 69</gradient>", "common", 8],
  ["<#ff007f>ツ", "common", 9],
  ["<#8b5a2b>$<#a06d3b>ᴡ<#c48b71>ɪ<#e8a0b0>ɴ", "common", 9],
  ["<gradient:#e52d27:#b31217>#дотакака</gradient>", "rare", 6],
  ["<gradient:#f12711:#f5af19>продам гараж</gradient>", "rare", 6],
  ["<gradient:#ff007f:#00f0ff>+6742148852</gradient>", "rare", 5],
  ["<gradient:#8aa29e:#b87cf8>sigeon_pex</gradient><#e2e8f0>.mp4", "rare", 5],
  ["<gradient:#ff007f:#b537ff>ɢᴀʏ</gradient><#00d2ff>мер", "rare", 5],
  ["<gradient:#39FF14:#00FF66>кабан🐗</gradient>", "rare", 5],
  ["<#888888>т<#cccccc>у<#ffffff>з <#888888>п<#111111>о<#666666>р<#999999>в<#cccccc>у", "epic", 4],
  ["<gradient:#ff2a70:#b537ff:#00d2ff>+ᴠɪʙᴇ✨</gradient>", "epic", 4],
  ["<gradient:#ff0080:#ff8c00>gimme % kid¡</gradient>", "epic", 3.5],
  ["<gradient:#eecda3:#ef629f>8===D</gradient>", "epic", 3.5],
  ["<gradient:#b87333:#f39c12:#d4af37:#ffdf73:#aa771c>богатый хуй</gradient>", "legendary", 1],
  ["<gradient:#4a0000:#cc0000:#ff1a1a:#cc0000:#4a0000>flекsтrиk</gradient>", "legendary", 1],
];

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function gradientAt(colors, t) {
  const seg = (colors.length - 1) * t;
  const i = Math.min(Math.floor(seg), colors.length - 2);
  const f = seg - i;
  const a = hexToRgb(colors[i]), b = hexToRgb(colors[i + 1]);
  return "#" + a.map((v, k) => Math.round(v + (b[k] - v) * f).toString(16).padStart(2, "0")).join("");
}

function parseMini(src) {
  const chars = [];
  let color = "#ffffff";
  let grad = null;
  const closeGradient = () => {
    if (!grad) return;
    const span = chars.length - grad.start;
    for (let i = 0; i < span; i++) chars[grad.start + i].color = gradientAt(grad.colors, span > 1 ? i / (span - 1) : 0);
    grad = null;
  };
  const re = /<(\/?)(gradient|bold|#[0-9a-fA-F]{6})((?::#[0-9a-fA-F]{6})*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[4] !== undefined) {
      for (const ch of m[4]) chars.push({ ch, color: grad ? null : color });
    } else if (m[2] === "gradient") {
      if (m[1]) closeGradient();
      else grad = { start: chars.length, colors: m[3].split(":").filter(Boolean) };
    } else if (m[2].startsWith("#") && !m[1]) {
      color = m[2];
    }
  }
  closeGradient();
  return chars;
}

const miniText = (src) => parseMini(src).map((c) => c.ch).join("");
function miniHTML(src) {
  const runs = [];
  for (const c of parseMini(src)) {
    const last = runs[runs.length - 1];
    if (last && last.color === c.color) last.text += c.ch;
    else runs.push({ color: c.color, text: c.ch });
  }
  return runs.map((r) => `<span style="color:${r.color}">${esc(r.text)}</span>`).join("");
}

// [привілей, рідкість, шанс на 30 днів, шанс назавжди]
const RANK_DROPS = [
  ["Біс", "common", 18, 8], ["Привид", "common", 14, 6], ["Цербер", "rare", 11, 4.5], ["Жнець", "rare", 9, 3],
  ["Демон", "epic", 7, 2], ["Архідемон", "epic", 5.5, 1.5], ["Владика", "legendary", 5, 1], ["Безодня", "legendary", 4, 0.5],
];
const rankLoot = () => [
  ...RANK_DROPS.map(([name, rarity, days]) => [`${name} · 30 днів`, rarity, days]),
  ...RANK_DROPS.map(([name, rarity, , forever]) => [`${name} · назавжди`, rarity, forever]),
];

const XP_DROPS = [
  ["500 досвіду", "common", 22], ["1 000 досвіду", "common", 18], ["2 500 досвіду", "common", 13],
  ["5 000 досвіду", "rare", 12], ["10 000 досвіду", "rare", 9], ["15 000 досвіду", "rare", 6],
  ["25 000 досвіду", "epic", 8], ["50 000 досвіду", "epic", 6],
  ["75 000 досвіду", "legendary", 5], ["100 000 досвіду", "legendary", 1],
];

// [назва, рідкість, шанс у %, (опційно) MiniMessage-титул]. Сума для кожного кейса = 100. Шанси чорнові — підлаштуємо разом.
const CASE_LOOT = {
  c_ranks: rankLoot(),
  c_titles: TITLES.map(([src, rarity, chance]) => [miniText(src), rarity, chance, src]),
  c_xp: XP_DROPS,
};

const EXTRAS = [
  { id: "unmute", name: "Розмут", color: "#9fb3c8", price: 49, icon: "М", desc: "Зняття мута в чаті (не діє на мут за образу адміністрації)." },
  { id: "unban", name: "Розбан", color: "#ff3b2f", price: 149, icon: "Р", desc: "Розбан акаунту. Не діє на бан за чити повторно." },
  { id: "nickcolor", name: "Кольоровий нік", color: "#ffb347", price: 39, icon: "Н", desc: "Вибери будь-який колір для ніку." },
  { id: "prefix", name: "Свій префікс", color: "#b04aff", price: 79, icon: "П", desc: "Унікальний префікс до 10 символів (з модерацією)." },
];

const PRODUCTS = [
  ...SUBS.map((s) => ({ ...s, cat: "sub" })),
  ...RANKS.map((r, i) => ({ ...r, cat: "rank", tier: i + 1 })),
  ...TOKEN_PACKS.map((t) => ({
    ...t, cat: "tokens", name: `${t.amount} фішок`, color: "#ff2424", icon: "T",
    desc: t.bonus ? `+${t.bonus} бонусних фішок у подарунок` : "Донат-валюта сервера",
  })),
  ...CASES.map((c) => ({ ...c, cat: "case" })),
  ...EXTRAS.map((e) => ({ ...e, cat: "extra" })),
];

const COMPARE_ROWS = [
  ["Точки дому", [3, 4, 4, 5, 5, 6, 7, 8]],
  ["Слоти аукціону", [5, 6, 7, 8, 10, 12, 15, 18]],
  ["Множник досвіду", ["1.1x", "1.2x", "1.3x", "1.4x", "1.5x", "1.6x", "1.8x", "2x"]],
  ["Затримка телепортації", ["5 с", "5 с", "4 с", "3 с", "2 с", "1 с", "Немає", "Немає"]],
  ["Префікс у чаті", [1, 1, 1, 1, 1, 1, 1, 1]],
  ["Особиста роль Discord", [1, 1, 1, 1, 1, 1, 1, 1]],
  ["/suicide", [1, 1, 1, 1, 1, 1, 1, 1]],
  ["/clear", [0, 1, 1, 1, 1, 1, 1, 1]],
  ["Ендер-скриня /ec", [0, 0, 1, 1, 1, 1, 1, 1]],
  ["/heal та /feed", [0, 0, 1, 1, 1, 1, 1, 1]],
  ["/repair", [0, 0, 0, 1, 1, 1, 1, 1]],
  ["/fly", [0, 0, 0, 0, 1, 1, 1, 1]],
  ["/setwarp та /delwarp", [0, 0, 0, 0, 0, 1, 1, 1]],
  ["Свій колір ніку", [0, 0, 0, 0, 0, 1, 1, 1]],
  ["/back", [0, 0, 0, 0, 0, 0, 1, 1]],
  ["/bc", [0, 0, 0, 0, 0, 0, 1, 1]],
  ["/near", [0, 0, 0, 0, 0, 0, 0, 1]],
  ["/amute та /unmute", [0, 0, 0, 0, 0, 0, 0, 1]],
  ["Знижка на кейси", ["—", "—", "—", "—", "10%", "10%", "20%", "25%"]],
];

/* =========================================================
   ЗАЯВКИ
   ========================================================= */
const ROLES = {
  moder: {
    name: "Moder", tag: "Модератор", minAge: 15, color: "#ff3b2f",
    desc: "Слідкує за порядком, видає покарання, розглядає скарги.",
    reqs: ["Вік від 15 років", "Онлайн від 3 годин на день", "Знання правил на 100%", "Робочий мікрофон", "Без активних покарань за 30 днів"],
    duties: ["Модерація чату та гри", "Перевірка на чити", "Розгляд скарг у Discord", "Звіт раз на тиждень"],
    fields: [
      { id: "modExp", label: "Досвід модерації (сервери, посади, термін)", type: "textarea", min: 40, full: true },
      { id: "mic", label: "Чи є робочий мікрофон?", type: "select", options: ["Так", "Ні"] },
      { id: "checks", label: "Чи вмієш перевіряти на чити (AnyDesk, перевірка процесів)?", type: "select", options: ["Так, впевнено", "Трохи", "Ні, але навчусь"] },
      { id: "sit1", label: "Ситуація: гравець образив твою маму в чаті. Твої дії?", type: "textarea", min: 40, full: true },
      { id: "sit2", label: "Ситуація: друг-адмін видає собі предмети. Твої дії?", type: "textarea", min: 40, full: true },
      { id: "sit3", label: "Ситуація: гравець підозрюється в X-ray, але доказів мало. Що робиш?", type: "textarea", min: 40, full: true },
    ],
  },
  helper: {
    name: "Helper", tag: "Хелпер", minAge: 14, color: "#ff9a3c",
    desc: "Допомагає новачкам, відповідає на питання, перша ланка команди.",
    reqs: ["Вік від 14 років", "Онлайн від 2 годин на день", "Ввічливість та терпіння", "Знання команд сервера", "Грамотне письмо"],
    duties: ["Відповіді на питання в чаті", "Допомога новачкам", "Модерація чату (мут)", "Тікети підтримки в Discord"],
    fields: [
      { id: "helpExp", label: "Чи був хелпером раніше? Де і скільки?", type: "textarea", min: 20, full: true },
      { id: "cmds", label: "Назви 5 корисних команд сервера та що вони роблять", type: "textarea", min: 40, full: true },
      { id: "sit1", label: "Ситуація: новачок не розуміє як створити регіон. Напиши свою відповідь йому", type: "textarea", min: 40, full: true },
      { id: "sit2", label: "Ситуація: гравець спамить і ображає хелперів. Що робиш?", type: "textarea", min: 30, full: true },
      { id: "stress", label: "Стресостійкість (1–10)", type: "number", minVal: 1, maxVal: 10 },
    ],
  },
  media: {
    name: "Media", tag: "Медіа / Ютубер", minAge: 13, color: "#b04aff",
    desc: "Знімає відео, стрімить та розвиває сервер у соцмережах.",
    reqs: ["Від 300 підписників (YouTube / TikTok / Twitch)", "Від 2 роликів/стрімів на місяць про сервер", "Якісний звук і картинка", "Посилання на сервер в описі"],
    duties: ["Контент про EVILVERSE", "Анонси івентів", "Посилання на сервер у відео"],
    perksText: "Отримуєш: привілей Демон на час співпраці, префікс [Media], фішки за перегляди.",
    fields: [
      { id: "platform", label: "Основна платформа", type: "select", options: ["YouTube", "TikTok", "Twitch", "YouTube Shorts", "Інше"] },
      { id: "channel", label: "Посилання на канал", type: "url", placeholder: "https://" },
      { id: "subs", label: "Кількість підписників", type: "number", minVal: 0 },
      { id: "views", label: "Середні перегляди на відео", type: "number", minVal: 0 },
      { id: "freq", label: "Скільки контенту на місяць про сервер?", type: "select", options: ["1–2", "3–5", "6–10", "10+"] },
      { id: "plan", label: "Контент-план: які відео / стріми плануєш?", type: "textarea", min: 50, full: true },
    ],
  },
  coder: {
    name: "Coder", tag: "Розробник", minAge: 14, color: "#3ee0c0",
    desc: "Пише плагіни, налаштовує сервер, Discord-ботів та сайт.",
    reqs: ["Знання Java (Paper / Spigot API)", "Досвід з Git", "Готовність виконати тестове завдання", "Розуміння конфігів плагінів"],
    duties: ["Розробка та фікс плагінів", "Налаштування конфігів", "Discord-боти та сайт", "Оптимізація сервера"],
    fields: [
      { id: "langs", label: "Мови програмування (через кому)", type: "text", placeholder: "Java, Kotlin, JS, Python..." },
      { id: "level", label: "Рівень", type: "select", options: ["Junior (до 1 року)", "Middle (1–3 роки)", "Senior (3+ роки)"] },
      { id: "github", label: "GitHub / портфоліо", type: "url", placeholder: "https://github.com/..." },
      { id: "api", label: "Знання API", type: "select", options: ["Paper/Spigot", "Bukkit", "Velocity/Bungee", "Fabric/Forge", "Не знаю"] },
      { id: "projects", label: "Які плагіни / проєкти робив? Опиши 1–3 найкращі", type: "textarea", min: 50, full: true },
      { id: "test", label: "Готовий виконати тестове завдання?", type: "select", options: ["Так", "Ні"] },
    ],
  },
};

const COMMON_FIELDS = [
  { legend: "Особисте", fields: [
    { id: "realName", label: "Реальне ім'я", type: "text", placeholder: "Наприклад: Олександр", min: 2 },
    { id: "age", label: "Вік", type: "number", minVal: 10, maxVal: 60 },
    { id: "country", label: "Країна / місто", type: "text", placeholder: "Україна, Київ" },
    { id: "timezone", label: "Часовий пояс", type: "select", options: ["UTC+2 / +3 (Київ)", "UTC+1 (Варшава)", "UTC+3 (інше)", "Інший"] },
  ]},
  { legend: "Акаунти", fields: [
    { id: "nick", label: "Нік у Minecraft", type: "text", placeholder: "Steve_666", pattern: "^[A-Za-z0-9_]{3,16}$", patternMsg: "3–16 символів: латиниця, цифри, _" },
    { id: "discordName", label: "Discord юзернейм", type: "text", placeholder: "evil.player" , min: 2 },
    { id: "discordId", label: "Discord ID", type: "text", placeholder: "123456789012345678", pattern: "^\\d{17,20}$", patternMsg: "17–20 цифр", hint: "Налаштування → Розширені → Режим розробника → ПКМ по собі → Копіювати ID" },
    { id: "playtime", label: "Скільки граєш на EVILVERSE?", type: "select", options: ["Менше тижня", "1–4 тижні", "1–3 місяці", "Більше 3 місяців"] },
  ]},
  { legend: "Активність", fields: [
    { id: "online", label: "Скільки годин на день можеш бути онлайн?", type: "select", options: ["1–2 год", "2–4 год", "4–6 год", "6+ год"] },
    { id: "days", label: "Коли зазвичай онлайн?", type: "text", placeholder: "Будні 16:00–22:00, вихідні весь день" },
    { id: "punish", label: "Чи мав покарання на сервері?", type: "select", options: ["Ні", "Так, мут", "Так, бан"] },
    { id: "otherProjects", label: "Чи є в команді інших серверів?", type: "select", options: ["Ні", "Так"] },
  ]},
];

const FINAL_FIELDS = { legend: "Про тебе", fields: [
  { id: "about", label: "Розкажи про себе (хобі, характер, сильні сторони)", type: "textarea", min: 60, full: true },
  { id: "why", label: "Чому саме ти? Чим будеш корисний серверу?", type: "textarea", min: 60, full: true },
  { id: "agree", label: "Я ознайомився з правилами, всі дані правдиві. Розумію, що обман = чорний список.", type: "checkbox", full: true },
]};

/* =========================================================
   ПРАВИЛА / FAQ
   ========================================================= */
const RULES = [
  { title: "1. Загальні правила", items: [
    ["1.1", "Заборонено ображати гравців, їх рідних, націю, релігію.", "Мут 1–24 год"],
    ["1.2", "Заборонено флуд, спам, капс (більше 3 однакових повідомлень).", "Мут 30 хв"],
    ["1.3", "Заборонена реклама інших серверів, сайтів, Discord-серверів.", "Бан 7 днів"],
    ["1.4", "Заборонено видавати себе за адміністрацію.", "Бан 3 дні"],
    ["1.5", "Заборонено продаж ігрових цінностей за реальні гроші.", "Бан назавжди"],
  ]},
  { title: "2. Ігровий процес", items: [
    ["2.1", "Заборонено використання читів, x-ray ресурс-паків, макросів, автокліків.", "Бан 30 днів / назавжди"],
    ["2.2", "Заборонено використання багів сервера. Знайшов баг — повідом у Discord і отримай нагороду.", "Бан 7 днів"],
    ["2.3", "Заборонено гриферство чужих регіонів.", "Бан 3 дні"],
    ["2.4", "Заборонено створення лаг-машин.", "Бан 14 днів"],
    ["2.5", "Заборонений скам (обман) при торгівлі.", "Бан 7 днів"],
    ["2.6", "Заборонено мати більше 3 твінків.", "Бан всіх акаунтів"],
  ]},
  { title: "3. Перевірка на чити", items: [
    ["3.1", "Вихід з сервера під час перевірки = визнання читів.", "Бан 30 днів"],
    ["3.2", "Відмова від перевірки = визнання читів.", "Бан 30 днів"],
    ["3.3", "Очищення історії/файлів під час перевірки.", "Бан назавжди"],
  ]},
  { title: "4. Discord", items: [
    ["4.1", "Пиши в канали за тематикою.", "Попередження"],
    ["4.2", "Заборонено NSFW-контент, шок-контент.", "Бан у Discord"],
    ["4.3", "Заборонено тегати адміністрацію без причини.", "Мут 1 год"],
  ]},
  { title: "5. Донат", items: [
    ["5.1", "Привілей не дає права порушувати правила.", "За порушене правило"],
    ["5.2", "Чарджбек (повернення платежу через банк) = блокування без повернення.", "Бан назавжди"],
    ["5.3", "Покарання з донатерів знімаються на загальних умовах.", "Без пільг і винятків"],
  ]},
];

const FAQ = [
  ["Яка версія сервера?", "Java Edition. Сервер працює на версіях від 1.8 до 26.2 — заходь з будь-якої з них."],
  ["Чи потрібна ліцензія?", "Ні, можна грати з будь-якого лаунчера (TLauncher, Legacy та інші)."],
  ["Як швидко видається донат?", "Після оплати створи тікет у Discord з кодом замовлення. Зазвичай видача до 30 хвилин, максимум 24 години."],
  ["Можна доплатити і підвищити привілей?", "Так! Платиш лише різницю між привілеями. Напиши в тікет — адмін порахує."],
  ["Що таке фішки?", "Донат-валюта сервера. За фішки можна купити кейси, привілеї (1 грн = 5 фішок), предмети на /shop та послуги."],
  ["Що таке оплата депом Case Bal?", "Ти поповнюєш наш баланс на кейс-сайті Case Bal (депозит-кодом або переказом балансу) на суму замовлення та скидаєш скрін у тікет."],
  ["Мене забанили несправедливо. Що робити?", "Створи тікет «Оскарження» у Discord. Додай нік, дату та докази. Розгляд до 48 годин."],
  ["Скільки розглядають заявки в адміністрацію?", "До 7 днів. Відповідь прийде в особисті в Discord, тож не закривай ЛС від учасників сервера."],
  ["Знайшов баг — що отримаю?", "Залежно від серйозності — від 100 до 1000 фішок. Пиши в канал #баги."],
];

/* =========================================================
   УТИЛІТИ
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const money = (n) => window.EvilCurrency ? window.EvilCurrency.format(n) : `${Math.round(n)} грн`;
const moneyUah = (n) => `${Math.round(n)} грн`;
const PAY_CURRENCY = { UAH: "UAH", RUB: "RUB", USDT: "USD" };
const moneyFor = (n, method) => window.EvilCurrency ? window.EvilCurrency.format(n, PAY_CURRENCY[CONFIG.PAYMENTS[method]?.currency] || "UAH") : money(n);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const genCode = (prefix) => `${prefix}-${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

function toast(msg, type = "") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.classList.add("hide"); setTimeout(() => t.remove(), 300); }, 2800);
}

async function copyText(text, msg = "Скопійовано!") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch {}
    ta.remove();
  }
  toast(msg);
}

/* =========================================================
   РОУТИНГ ВКЛАДОК
   ========================================================= */
const TABS = ["home", "shop", "apply", "rules", "faq", "profile"];
function showTab(tab, push = true) {
  if (!TABS.includes(tab)) tab = "home";
  $$(".page").forEach((p) => (p.hidden = p.dataset.page !== tab));
  $$(".nav-link").forEach((l) => l.classList.toggle("active", l.dataset.tab === tab));
  if (push && location.hash !== `#${tab}`) history.pushState(null, "", `#${tab}`);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  if (tab === "profile") renderProfile();
  observeReveal();
}
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-tab]");
  if (!link) return;
  e.preventDefault();
  showTab(link.dataset.tab);
});
window.addEventListener("popstate", () => showTab(location.hash.slice(1), false));

const burger = $("#burger");
function closeMenu() { $("#nav").classList.remove("open"); burger.setAttribute("aria-expanded", "false"); }
burger.addEventListener("click", () => {
  const open = $("#nav").classList.toggle("open");
  burger.setAttribute("aria-expanded", String(open));
});

/* =========================================================
   ГОЛОВНА: IP, статус, Discord, таймер
   ========================================================= */
$("#copyIp").addEventListener("click", () => copyText(CONFIG.IP, `IP ${CONFIG.IP} скопійовано!`));
$("#ipValue").addEventListener("click", () => copyText(CONFIG.IP, `IP ${CONFIG.IP} скопійовано!`));

const STATUS_POLL_MS = 10000;
let statusTimer = null;
let shownOnline = null;
let countAnim = null;

function animateCount(el, to) {
  if (shownOnline === null || shownOnline === to || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = to;
    shownOnline = to;
    return;
  }
  cancelAnimationFrame(countAnim);
  const from = shownOnline, start = performance.now(), dur = 600;
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur);
    el.textContent = Math.round(from + (to - from) * k);
    if (k < 1) countAnim = requestAnimationFrame(step);
  };
  countAnim = requestAnimationFrame(step);
  shownOnline = to;
}

async function loadStatus() {
  const dot = $("#statusDot"), text = $("#statusText");
  try {
    const r = await fetch("/api/status", { cache: "no-store" });
    if (!r.ok) throw new Error("status " + r.status);
    const d = await r.json();
    if (d.online) {
      const online = d.players?.online ?? 0;
      dot.className = "pulse-dot on";
      text.textContent = `Сервер онлайн · ${online} гравців`;
      animateCount($("#statOnline"), online);
      $("#statMax").textContent = d.players?.max || "—";
      $("#statVersion").textContent = CONFIG.VERSIONS;
    } else {
      dot.className = "pulse-dot off";
      text.textContent = "Сервер офлайн або перезавантажується";
      animateCount($("#statOnline"), 0);
      $("#statVersion").textContent = CONFIG.VERSIONS;
    }
  } catch {
    dot.className = "pulse-dot";
    text.textContent = `Заходь: ${CONFIG.IP}`;
  }
}

function startStatusPolling() {
  clearInterval(statusTimer);
  loadStatus();
  statusTimer = setInterval(loadStatus, STATUS_POLL_MS);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearInterval(statusTimer);
  else startStatusPolling();
});

async function loadDiscord() {
  try {
    const r = await fetch(`https://discord.com/api/v10/invites/${CONFIG.DISCORD_CODE}?with_counts=true`);
    const d = await r.json();
    if (d.approximate_member_count) $("#statDiscord").textContent = d.approximate_member_count;
  } catch {}
}

const KYIV_FORMAT = (() => {
  const options = { hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" };
  try { return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "Europe/Kyiv" }); }
  catch { return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "Europe/Kiev" }); }
})();
function kyivWall(date) {
  const w = {};
  for (const p of KYIV_FORMAT.formatToParts(date)) if (p.type !== "literal") w[p.type] = Number(p.value);
  return w;
}
function kyivOffsetMs(date) {
  const w = kyivWall(date);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(date.getTime() / 1000) * 1000;
}
function nextSaturday18() {
  const now = new Date();
  const w = kyivWall(now);
  const dow = new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay();
  const at = (days) => {
    const guess = Date.UTC(w.year, w.month - 1, w.day + days, 18);
    return new Date(guess - kyivOffsetMs(new Date(guess)));
  };
  const days = (6 - dow + 7) % 7;
  const t = at(days);
  return t > now ? t : at(days + 7);
}
function tickCountdown() {
  const ms = Math.max(0, nextSaturday18() - new Date());
  const pad = (n) => String(n).padStart(2, "0");
  $("#cdD").textContent = pad(Math.floor(ms / 864e5));
  $("#cdH").textContent = pad(Math.floor(ms / 36e5) % 24);
  $("#cdM").textContent = pad(Math.floor(ms / 6e4) % 60);
  $("#cdS").textContent = pad(Math.floor(ms / 1e3) % 60);
}

/* =========================================================
   МАГАЗИН
   ========================================================= */
let currentCat = "all";
const tokenPrice = (p) => Math.round(p.price * CONFIG.TOKEN_RATE);

function itemStyle(p) { return `--accent:${p.color};--glow:${p.color}44`; }
function iconImg(id) { return `<img src="/shop/${esc(id)}.webp" alt="" width="64" height="64" decoding="async" draggable="false">`; }

function renderShop() {
  const list = PRODUCTS.filter((p) => currentCat === "all" || p.cat === currentCat);
  $("#shopGrid").innerHTML = list.map((p) => {
    const tier = p.cat === "rank" ? `Рівень ${p.tier} з ${RANKS.length}` : { sub: "Підписка · 30 днів", tokens: "Фішки", case: "Кейс", extra: "Послуга" }[p.cat];
    const ribbon = p.hot ? `<span class="ribbon">ХІТ</span>` : p.popular ? `<span class="ribbon">ТОП</span>` : "";
    const coin = `<i class="fishka-ico" aria-hidden="true"></i>`;
    const sub = p.cat === "rank" ? `або ${tokenPrice(p)} фішок · назавжди${coin}`
      : p.cat === "sub" ? `або ${p.ingame} фішок у грі (/prime)${coin}`
      : p.cat === "tokens" && p.bonus ? `Разом: ${p.amount + p.bonus} фішок${coin}` : "";
    return `<button class="item${p.cat === "tokens" ? " item--chips" : ""}" style="${itemStyle(p)}" data-id="${p.id}" aria-label="${esc(tr(p.name))}, ${money(p.price)}">
      ${ribbon}
      <span class="item-tier">${tier}</span>
      <span class="item-icon">${iconImg(p.id)}</span>
      <span class="item-name">${esc(p.name)}${p.cat === "tokens" ? coin : ""}</span>
      <span class="item-desc">${esc(p.desc)}</span>
      <span class="item-price">${money(p.price)}</span>
      ${sub ? `<span class="item-sub">${sub}</span>` : ""}
    </button>`;
  }).join("");
}

function renderCompare() {
  const head = `<thead><tr><th scope="col">Можливість</th>${RANKS.map((r) => `<th scope="col" class="rank-col" style="--rank:${r.color}"><span>${r.name}</span></th>`).join("")}</tr></thead>`;
  const cell = (v) => v === 1 ? '<span class="yes" role="img" aria-label="Так"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/></svg></span>'
    : v === 0 ? '<span class="no" role="img" aria-label="Ні"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/></svg></span>'
    : /^\d/.test(String(v)) || v === "Немає" ? `<span class="val">${esc(v)}</span>` : `<span class="dash">${esc(v)}</span>`;
  const body = COMPARE_ROWS.map(([label, vals]) =>
    `<tr><th scope="row">${label}</th>${vals.map((v, i) => `<td style="--rank:${RANKS[i].color}">${cell(v)}</td>`).join("")}</tr>`).join("");
  const price = `<tr class="price-row"><th scope="row">Ціна</th>${RANKS.map((r) => `<td style="--rank:${r.color}">${money(r.price)}</td>`).join("")}</tr>`;
  $("#compareTable").innerHTML = head + `<tbody>${body}${price}</tbody>`;
}

$$(".chip").forEach((c) => c.addEventListener("click", () => {
  $$(".chip").forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-selected", "false"); });
  c.classList.add("active"); c.setAttribute("aria-selected", "true");
  currentCat = c.dataset.cat;
  renderShop();
}));

$("#shopGrid").addEventListener("click", (e) => {
  const btn = e.target.closest(".item");
  if (btn) openProduct(btn.dataset.id);
});

/* ---------- Modal ---------- */
let lastFocus = null;
function openModal(html) {
  lastFocus = document.activeElement;
  $("#modalContent").innerHTML = html;
  $("#modal").hidden = false;
  document.body.classList.add("locked");
  setTimeout(() => $(".modal-box").focus?.(), 0);
}
function closeModal() {
  $("#modal").hidden = true;
  if ($("#drawer").hidden) document.body.classList.remove("locked");
  lastFocus?.focus?.();
}
$("#modal").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("#modal").hidden) closeModal();
  else if (!$("#drawer").hidden) closeDrawer();
});

function openProduct(id) {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) return;
  const rankIdx = RANKS.findIndex((r) => r.id === p.id);
  const inherited = rankIdx > 0 ? `<li class="inherit">+ всі можливості привілею ${RANKS[rankIdx - 1].name}</li>` : "";
  const perks = p.perks ? `<ul class="perks"${p.cat === "case" ? ` style="--bullet:${p.color}"` : ""}>${p.perks.map((x) => `<li>${esc(x)}</li>`).join("")}${inherited}</ul>` : "";

  let options = "";
  if (p.cat === "rank") {
    options = `<div class="opt-group"><span>Термін</span><div class="opts">
      <label class="opt"><input type="radio" name="dur" value="30" /><b>30 днів</b><small>${money(Math.round(p.price * 0.4))}</small></label>
      <label class="opt"><input type="radio" name="dur" value="forever" checked /><b>Назавжди</b><small>${money(p.price)} · вигідно</small></label>
    </div></div>`;
  } else if (p.cat === "sub") {
    options = `<div class="opt-group"><span>Термін</span><div class="opts">
      <label class="opt"><input type="radio" name="dur" value="30" checked /><b>30 днів</b><small>${money(p.price)}</small></label>
    </div></div>
    <p class="muted small">Видається автоматично, щойно оплату підтверджено. Якщо підписка вже є — час додається.
      Також можна купити в грі за <span class="fishka">${p.ingame}<i class="fishka-ico" aria-hidden="true"></i></span> фішок: /prime</p>`;
  } else {
    options = `<div class="opt-group"><span>Кількість</span><div class="qty">
      <button type="button" data-q="-1" aria-label="Менше">−</button><span id="qtyVal">1</span><button type="button" data-q="1" aria-label="Більше">+</button>
    </div></div>`;
  }

  openModal(`
    <div class="m-head" style="${itemStyle(p)}">
      <span class="item-icon">${iconImg(p.id)}</span>
      <div><span class="item-tier">${p.cat === "rank" ? `Привілей · рівень ${p.tier}` : p.cat === "sub" ? "Підписка · 30 днів" : "Товар"}</span><h2 id="modalTitle" style="color:${p.color}">${esc(p.name)}</h2></div>
    </div>
    <p class="muted">${esc(p.desc)}</p>
    ${perks}
    ${p.cat === "case" ? lootHTML(p.id) : ""}
    ${options}
    <div class="m-total"><span>Разом</span><b id="mTotal">${money(p.price)}</b></div>
    <div class="m-actions">
      <button class="btn btn-ghost" id="addCart">У кошик</button>
      <button class="btn btn-ghost" id="giftNow">Подарувати другу</button>
      <button class="btn btn-fire" id="buyNow">Купити зараз</button>
    </div>
  `);

  let qty = 1;
  const calc = () => {
    if (p.cat === "rank") {
      const dur = $('input[name="dur"]:checked').value;
      return { price: dur === "30" ? Math.round(p.price * 0.4) : p.price, label: dur === "30" ? "30 днів" : "Назавжди", qty: 1 };
    }
    if (p.cat === "sub") return { price: p.price, label: "30 днів", qty: 1 };
    return { price: p.price * qty, label: "", qty };
  };
  const update = () => { $("#mTotal").textContent = money(calc().price); };
  $$('input[name="dur"]').forEach((r) => r.addEventListener("change", update));
  $$("[data-q]").forEach((b) => b.addEventListener("click", () => {
    qty = Math.min(20, Math.max(1, qty + Number(b.dataset.q)));
    $("#qtyVal").textContent = qty; update();
  }));
  const add = () => {
    const c = calc();
    addToCart({ id: p.id, name: p.name, color: p.color, icon: p.icon, unit: c.price / c.qty, qty: c.qty, label: c.label, cat: p.cat });
  };
  $("#addCart").addEventListener("click", () => { add(); closeModal(); toast(`${p.name} додано в кошик`); });
  $("#buyNow").addEventListener("click", () => { add(); closeModal(); openCheckout(); });
  $("#giftNow").addEventListener("click", () => { add(); closeModal(); openCheckout({ gift: true }); });
  if (p.cat === "case") { initLootToggle(); initRoll(p.id); }
}

function initLootToggle() {
  const box = $("#lootDetails"), btn = $("#lootToggle"), panel = $("#lootCollapse");
  if (!box || !btn || !panel) return;
  btn.addEventListener("click", () => {
    const open = !box.classList.contains("is-open");
    box.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
    panel.toggleAttribute("inert", !open);
  });
}

const fmtChance = (n) => (Number.isInteger(n) ? n : n.toFixed(1)) + "%";

function lootLabel(l, translate = false) {
  if (l[3]) return `<span class="mc-title no-i18n">${miniHTML(l[3])}</span>`;
  return esc(translate ? tr(l[0]) : l[0]);
}

function lootHTML(id) {
  const loot = CASE_LOOT[id];
  if (!loot) return "";
  const theme = CASE_THEME[id];
  const groups = Object.entries(RARITY)
    .map(([key, meta]) => ({ key, name: meta.name, color: rarityColor(id, key), items: loot.filter((l) => l[1] === key) }))
    .filter((g) => g.items.length)
    .map((g) => ({ ...g, sum: g.items.reduce((acc, l) => acc + l[2], 0) }));
  const bar = groups.map((g) => `<span style="width:${g.sum}%;background:${g.color}"></span>`).join("");
  const list = groups.map((g) => `<div class="loot-group" style="--rar:${g.color}">
      <h4><span>${esc(g.name)}</span><span>${fmtChance(g.sum)}</span></h4>
      ${g.items.map((l) => `<div class="loot-row"><span>${lootLabel(l)}</span><b>${fmtChance(l[2])}</b></div>`).join("")}
    </div>`).join("");
  const preview = loot.slice(0, 6).map((l) => `<div class="roll-cell" style="--rar:${rarityColor(id, l[1])}"><span>${lootLabel(l)}</span></div>`).join("");
  return `<div class="loot ${theme?.className ?? ""}" style="--loot-accent:${theme?.accent ?? "#ffd23f"}">
    <div class="loot-details" id="lootDetails">
      <button type="button" class="loot-summary" id="lootToggle" aria-expanded="false" aria-controls="lootCollapse">
        <span class="loot-title">
          <span>Що може випасти</span>
          <span class="loot-toggle"><span class="when-closed">Показати шанси</span><span class="when-open">Сховати шанси</span><i aria-hidden="true"></i></span>
        </span>
        <span class="loot-bar" aria-hidden="true">${bar}</span>
      </button>
      <div class="loot-collapse" id="lootCollapse" inert>
        <div class="loot-collapse-inner"><div class="loot-list">${list}</div></div>
      </div>
    </div>
    <div class="roll">
      <div class="roll-window"><div class="roll-strip" id="rollStrip">${preview}</div></div>
      <div class="roll-result" id="rollResult" aria-live="polite"></div>
      <button type="button" class="btn btn-ghost btn-block" id="rollBtn">Тестове відкриття</button>
      <p class="roll-note">Це демо: нічого не списується і нічого не видається.</p>
    </div>
  </div>`;
}

function initRoll(id) {
  const loot = CASE_LOOT[id];
  const btn = $("#rollBtn"), strip = $("#rollStrip"), result = $("#rollResult");
  if (!loot || !btn) return;
  const pick = () => {
    let r = Math.random() * 100;
    for (const l of loot) { r -= l[2]; if (r < 0) return l; }
    return loot[0];
  };
  btn.addEventListener("click", () => {
    btn.disabled = true;
    result.textContent = "";
    const winner = pick();
    const total = 44, stop = 36, cellW = 120;
    const cells = Array.from({ length: total }, (_, i) => (i === stop ? winner : pick()));
    strip.style.transition = "none";
    strip.style.transform = "translateX(0)";
    strip.innerHTML = cells.map((c) => `<div class="roll-cell" style="--rar:${rarityColor(id, c[1])}"><span>${lootLabel(c, true)}</span></div>`).join("");
    const target = stop * cellW + cellW / 2 - $(".roll-window").clientWidth / 2 + (Math.random() * 60 - 30);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    void strip.offsetWidth;
    strip.style.transition = reduced ? "none" : "transform 4.2s cubic-bezier(.12,.7,.1,1)";
    strip.style.transform = `translateX(${-target}px)`;
    const done = () => {
      result.style.color = rarityColor(id, winner[1]);
      result.innerHTML = `${esc(tr("Випало:"))} ${lootLabel(winner, true)} · ${fmtChance(winner[2])}`;
      btn.disabled = false;
    };
    if (reduced) done(); else setTimeout(done, 4300);
  });
}

/* ---------- Cart ---------- */
let cart = store.get("ev_cart", []);
let promo = store.get("ev_promo", null);
let promoPct = store.get("ev_promo_pct", 0);

function saveCart() { store.set("ev_cart", cart); store.set("ev_promo", promo); store.set("ev_promo_pct", promoPct); renderCart(); }
function addToCart(item) {
  if (item.cat === "rank") cart = cart.filter((c) => c.cat !== "rank");
  if (item.cat === "sub") cart = cart.filter((c) => c.cat !== "sub");
  const key = `${item.id}|${item.label}`;
  const ex = cart.find((c) => `${c.id}|${c.label}` === key);
  if (ex && item.cat !== "rank") ex.qty = Math.min(20, ex.qty + item.qty);
  else cart.push(item);
  saveCart();
  const b = $("#cartCount"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
}
function totals() {
  const sub = cart.reduce((s, c) => s + c.unit * c.qty, 0);
  const pct = promo ? promoPct : 0;
  const disc = Math.round(sub * pct / 100);
  return { sub, disc, total: sub - disc, pct };
}
function renderCart() {
  $("#cartCount").textContent = cart.reduce((s, c) => s + c.qty, 0);
  const box = $("#cartItems");
  if (!cart.length) {
    box.innerHTML = `<div class="empty"><p>Кошик порожній</p><p class="small">Перейди в магазин і вибери щось пекельне</p></div>`;
  } else {
    box.innerHTML = cart.map((c, i) => `<div class="cart-item">
      <span class="item-icon" style="--accent:${c.color};--glow:${c.color}44">${iconImg(c.id)}</span>
      <div class="cart-item-info"><b>${esc(c.name)}</b><small>${c.label ? esc(c.label) + " · " : ""}${c.qty} × ${money(c.unit)}</small></div>
      <b>${money(c.unit * c.qty)}</b>
      <button class="cart-remove" data-rm="${i}" aria-label="${esc(tr("Видалити"))} ${esc(tr(c.name))}">×</button>
    </div>`).join("");
  }
  const t = totals();
  $("#cartSubtotal").textContent = money(t.sub);
  $("#cartDiscount").textContent = `−${money(t.disc)} (${promo})`;
  $("#discountRow").hidden = !t.disc;
  $("#cartTotal").textContent = money(t.total);
  $("#checkoutBtn").disabled = !cart.length;
  if (promo) $("#promoInput").value = promo;
}
$("#cartItems").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rm]");
  if (b) { cart.splice(Number(b.dataset.rm), 1); saveCart(); }
});
$("#promoApply").addEventListener("click", async () => {
  const code = $("#promoInput").value.trim().toUpperCase();
  if (!code) { promo = null; promoPct = 0; saveCart(); return; }
  try {
    const res = await fetch("/api/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    if (res.status === 429) return toast("Забагато спроб. Спробуй трохи пізніше", "error");
    const d = await res.json();
    if (d.valid) { promo = d.code; promoPct = d.percent; saveCart(); toast(`Промокод ${d.code} застосовано: −${d.percent}%`); }
    else toast("Такого промокоду не існує", "error");
  } catch { toast("Не вдалося перевірити промокод", "error"); }
});
$("#promoInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) $("#promoApply").click();
});

function openDrawer() { $("#drawer").hidden = false; document.body.classList.add("locked"); }
function closeDrawer() { $("#drawer").hidden = true; if ($("#modal").hidden) document.body.classList.remove("locked"); }
$("#cartBtn").addEventListener("click", openDrawer);
$("#drawer").addEventListener("click", (e) => { if (e.target.closest("[data-close-drawer]")) closeDrawer(); });
$("#checkoutBtn").addEventListener("click", () => { closeDrawer(); openCheckout(); });

/* ---------- Checkout ---------- */
const NICK_RE = /^[A-Za-z0-9_]{3,16}$/;
const ORDER_ERRORS = {
  bad_nick: "Нік: 3–16 символів (латиниця, цифри, _)",
  bad_gift_nick: "Нік отримувача: 3–16 символів, і це не твій нік",
  bad_discord: "Вкажи свій Discord",
  bad_method: "Обери доступний спосіб оплати",
  bad_promo: "Такого промокоду не існує",
  one_sub_only: "Одна підписка Prime на замовлення",
  too_many_requests: "Забагато спроб. Спробуй трохи пізніше",
};
const dayLabel = (dur) => (dur === "30" ? "30 днів" : dur === "forever" ? "Назавжди" : "");

function openCheckout(opts = {}) {
  if (!cart.length) { toast("Кошик порожній", "error"); return; }
  const t = totals();
  const saved = store.get("ev_user", {});
  const firstAvailable = Object.entries(CONFIG.PAYMENTS).find(([, m]) => m.available !== false)?.[0];
  const methods = Object.entries(CONFIG.PAYMENTS).map(([k, m]) => {
    const off = m.available === false;
    return `<label class="opt${off ? " is-disabled" : ""}"><input type="radio" name="pay" value="${k}" ${k === firstAvailable ? "checked" : ""} ${off ? "disabled" : ""} /><b>${m.name}</b><small>${m.note}</small><span class="opt-meta"><span class="cur">${m.currency}</span>${off ? `<span class="soon">${m.status}</span>` : ""}</span></label>`;
  }).join("");
  openModal(`
    <h2 id="modalTitle" class="page-title" style="font-size:34px">Оформлення</h2>
    <p class="muted">${cart.length} товар(и) · до сплати <b style="color:var(--amber)">${money(t.total)}</b></p>
    <form id="checkoutForm" novalidate>
      <div class="fieldset">
        <div class="field"><label for="coNick">Нік у грі <span class="req">*</span></label><input id="coNick" required value="${esc(saved.nick || "")}" placeholder="Steve_666" /></div>
        <div class="field"><label for="coDiscord">Discord <span class="req">*</span></label><input id="coDiscord" required value="${esc(saved.discord || "")}" placeholder="evil.player" /></div>
      </div>
      <div class="gift-box">
        <label class="gift-toggle"><input type="checkbox" id="giftOn" ${opts.gift ? "checked" : ""} /><span><b>Купити в подарунок другу</b><small>Покупку отримає інший гравець — вкажи його нік</small></span></label>
        <div class="gift-fields" id="giftFields" ${opts.gift ? "" : "hidden"}>
          <div class="field"><label for="giftTo">Нік отримувача <span class="req">*</span></label><input id="giftTo" autocomplete="off" placeholder="Alex_Mine" /></div>
          <div class="field"><label for="giftMsg">Побажання (необов&apos;язково)</label><textarea id="giftMsg" maxlength="140" placeholder="З днем народження!"></textarea><div class="gift-count"><span id="giftLen">0</span>/140</div></div>
        </div>
      </div>
      <div class="opt-group"><span>Спосіб оплати</span><div class="pay-methods">${methods}</div></div>
      <label class="checkbox"><input type="checkbox" id="coAgree" /> <span>Я погоджуюсь з правилами донату (п. 5). Товар видається автоматично, у разі проблем — тікет у Discord</span></label>
      <div class="m-total"><span>До сплати</span><b>${money(t.total)}</b></div>
      <button class="btn btn-fire btn-block" type="submit">Отримати реквізити</button>
    </form>
  `);
  $("#giftOn").addEventListener("change", (e) => {
    $("#giftFields").hidden = !e.target.checked;
    if (e.target.checked) $("#giftTo").focus();
  });
  $("#giftMsg").addEventListener("input", (e) => { $("#giftLen").textContent = e.target.value.length; });
  if (opts.gift) setTimeout(() => $("#giftTo")?.focus(), 50);

  $("#checkoutForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = $('#checkoutForm button[type="submit"]');
    const nick = $("#coNick").value.trim();
    const discord = $("#coDiscord").value.trim();
    const giftOn = $("#giftOn").checked;
    const giftTo = giftOn ? $("#giftTo").value.trim() : "";
    if (!NICK_RE.test(nick)) return toast(ORDER_ERRORS.bad_nick, "error");
    if (discord.length < 2) return toast(ORDER_ERRORS.bad_discord, "error");
    if (giftOn && !NICK_RE.test(giftTo)) return toast(ORDER_ERRORS.bad_gift_nick, "error");
    if (giftOn && giftTo.toLowerCase() === nick.toLowerCase()) return toast("Не можна подарувати самому собі", "error");
    if (!$("#coAgree").checked) return toast("Підтверди згоду з правилами донату", "error");
    const checkedMethod = $('input[name="pay"]:checked');
    if (!checkedMethod || CONFIG.PAYMENTS[checkedMethod.value]?.available === false) return toast("Обери доступний спосіб оплати", "error");
    const method = checkedMethod.value;

    submit.disabled = true;
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nick, discord, method, promo,
          items: cart.map((c) => ({ id: c.id, qty: c.qty, dur: c.cat === "rank" ? (c.label === "30 днів" ? "30" : "forever") : c.cat === "sub" ? "30" : undefined })),
          gift: giftOn ? { to: giftTo, message: $("#giftMsg").value.trim() } : null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(ORDER_ERRORS[d.error] || "Не вдалося створити замовлення. Спробуй ще раз", "error");
        submit.disabled = false;
        return;
      }
      store.set("ev_user", { ...store.get("ev_user", {}), nick, discord });
      const order = {
        code: d.code, nick, discord, method, total: d.total, promo: d.promo, payAmount: d.payAmount,
        giftTo: d.giftTo, giftMessage: d.giftMessage, date: d.createdAt, status: "Очікує оплату",
        items: d.items.map((i) => ({ id: i.id, name: PRODUCTS.find((x) => x.id === i.id)?.name || i.id, label: dayLabel(i.dur), qty: i.qty, unit: i.unit })),
      };
      const orders = store.get("ev_orders", []); orders.unshift(order); store.set("ev_orders", orders);
      cart = []; promo = null; promoPct = 0; saveCart(); $("#promoInput").value = "";
      showPayment(order);
    } catch {
      toast("Не вдалося створити замовлення. Спробуй ще раз", "error");
      submit.disabled = false;
    }
  });
}

function orderText(o) {
  const gift = o.giftTo ? `\nПодарунок для: ${o.giftTo}${o.giftMessage ? ` («${o.giftMessage}»)` : ""}` : "";
  return `Замовлення ${o.code}\nНік: ${o.nick}\nDiscord: ${o.discord}${gift}\nТовари: ${o.items.map((i) => `${i.name}${i.label ? " (" + i.label + ")" : ""} x${i.qty}`).join(", ")}\nСума: ${moneyUah(o.total)}${window.EvilCurrency && window.EvilCurrency.code !== "UAH" ? ` (≈ ${money(o.total)})` : ""}\nОплата: ${CONFIG.PAYMENTS[o.method]?.name || o.method}${o.payAmount ? ` (${o.payAmount} USDT)` : ""}`;
}

// Посилання на банку з уже заповненою сумою (грн) і кодом у коментарі
function monoPayUrl(link, o) {
  const u = new URL(link);
  u.searchParams.set("a", String(o.total));
  u.searchParams.set("t", o.code);
  return u.toString();
}

// Посилання ton:// — гаманець (Tonkeeper тощо) відкриється з уже заповненими адресою, сумою USDT і коментарем
function tonPayUrl(m, o) {
  const micro = Math.round(Number(o.payAmount) * 1e6);
  return `ton://transfer/${m.details}?jetton=${m.jetton}&amount=${micro}&text=${encodeURIComponent(o.code)}`;
}

function showPayment(o) {
  const m = CONFIG.PAYMENTS[o.method] || { name: o.method, details: "" };
  const steps = {
    casebal: [`Зайди на сайт Case Bal та поповни баланс / створи депозит-код на <b>${moneyFor(o.total, o.method)}</b>`, `Передай депозит на акаунт адміністрації (${esc(m.details)})`, "Зроби скріншот підтвердження"],
    mono: m.auto
      ? ["Натисни «Оплатити» — відкриється банка monobank. Підходить будь-яка картка, Apple Pay чи Google Pay", `Сума: <b>${moneyFor(o.total, o.method)}</b>`, `У коментарі до платежу встав код <b>${o.code}</b> — без нього оплата не зарахується автоматично`, "Товар прийде в гру сам протягом 1–2 хвилин після оплати. Статус видно у вкладці «Кабінет»"]
      : [`Переведи <b>${moneyFor(o.total, o.method)}</b> за реквізитами нижче`, `У коментарі вкажи код <b>${o.code}</b>`, "Збережи квитанцію"],
    privat: [`Переведи <b>${moneyFor(o.total, o.method)}</b> на карту нижче`, `У коментарі вкажи код <b>${o.code}</b>`, "Збережи квитанцію"],
    ton: [`Надішли рівно <b>${o.payAmount} USDT</b> у мережі <b>TON</b> — з Telegram Wallet, Tonkeeper чи іншого гаманця TON`, "Адресу й суму скопіюй вище або натисни «Відкрити в гаманці» — усе заповниться само", `У коментарі (Comment / Memo) встав код <b>${o.code}</b> — без нього оплата не зарахується автоматично`, "Товар прийде в гру сам за 1–2 хвилини після підтвердження переказу. Статус видно у вкладці «Кабінет»"],
    crypto: m.auto && o.payAmount ? [`Надішли рівно <b>${o.payAmount} USDT</b> у мережі <b>TRC20 (TRON)</b> на адресу вище`, "Сума — саме така, до тисячних: за нею сайт впізнає твій платіж (коментар у TRON не передається)", "Платиш з біржі (Binance тощо)? Вкажи суму так, щоб після комісії біржі на адресу дійшло рівно стільки", "Товар прийде в гру сам за 1–3 хвилини після підтвердження переказу. Статус видно у вкладці «Кабінет»"]
      : [`Відправ еквівалент <b>${moneyFor(o.total, o.method)}</b> у USDT (мережа TRC20)`, "Перевір мережу — інша мережа = втрата коштів", "Збережи хеш транзакції (TxID)"],
    sbp: [`Переведи еквівалент <b>${moneyFor(o.total, o.method)}</b> у рублях за реквізитами нижче`, `У коментарі вкажи код <b>${o.code}</b>`, "Збережи квитанцію"],
    rucard: [`Переведи еквівалент <b>${moneyFor(o.total, o.method)}</b> у рублях на карту нижче`, `У коментарі вкажи код <b>${o.code}</b>`, "Збережи квитанцію"],
  }[o.method];
  openModal(`
    <div class="success-icon">✓</div>
    <h2 id="modalTitle" style="font-size:30px">Замовлення створено</h2>
    <p class="muted">Оплата: ${esc(m.name)}</p>
    ${o.giftTo ? `<div class="gift-card"><span class="muted small">Подарунок для</span><br><b>${esc(o.giftTo)}</b>${o.giftMessage ? `<p>«${esc(o.giftMessage)}»</p>` : ""}</div>` : ""}
    <div class="instructions">
      <span class="muted small">Код замовлення</span>
      <div class="copy-row"><code>${o.code}</code><button class="btn btn-ghost btn-sm" data-copy="${o.code}">Копіювати</button></div>
      ${o.method === "mono" && m.auto ? "" : `<span class="muted small">${o.method === "ton" ? "Адреса гаманця (мережа TON)" : o.method === "crypto" && m.auto ? "Адреса гаманця (мережа TRC20)" : "Реквізити"}</span>
      <div class="copy-row"><code>${esc(m.details)}</code><button class="btn btn-ghost btn-sm" data-copy="${esc(m.details)}">Копіювати</button></div>`}
      ${(o.method === "ton" || (o.method === "crypto" && m.auto)) && o.payAmount ? `<span class="muted small">Сума</span>
      <div class="copy-row"><code>${esc(o.payAmount)} USDT</code><button class="btn btn-ghost btn-sm" data-copy="${esc(o.payAmount)}">Копіювати</button></div>` : ""}
      <ol>${steps.map((s) => `<li>${s}</li>`).join("")}${m.auto ? "" : "<li>Створи тікет «Донат» у Discord, встав код і скрін оплати</li>"}</ol>
      ${o.method === "mono" && m.auto ? `<a class="btn btn-fire btn-block" href="${esc(monoPayUrl(m.details, o))}" target="_blank" rel="noopener">Оплатити ${moneyFor(o.total, o.method)}</a>` : ""}
      ${o.method === "ton" && o.payAmount ? `<a class="btn btn-fire btn-block" href="${esc(tonPayUrl(m, o))}">Відкрити в гаманці</a>` : ""}
    </div>
    <div class="m-actions">
      <button class="btn btn-ghost" id="copyOrder">Копіювати для тікету</button>
      <a class="btn btn-discord" href="${CONFIG.DISCORD}" target="_blank" rel="noopener">Відкрити Discord</a>
    </div>
    <p class="muted small" style="margin-top:12px">Замовлення збережено у вкладці «Кабінет».</p>
  `);
  $$("[data-copy]").forEach((b) => b.addEventListener("click", () => copyText(b.dataset.copy)));
  $("#copyOrder").addEventListener("click", () => copyText(orderText(o), "Текст для тікету скопійовано!"));
}

/* =========================================================
   ЗАЯВКИ
   ========================================================= */
let currentRole = null;

function renderRoles() {
  $("#roles").innerHTML = Object.entries(ROLES).map(([k, r]) => `
    <button class="role" data-role="${k}" style="--accent:${r.color}">
      <span class="role-tag">${r.tag}</span>
      <h3 style="color:${r.color}">${r.name}</h3>
      <p>${r.desc}</p>
      <span class="role-status">● Набір відкрито · від ${r.minAge} років</span>
    </button>`).join("");
}
$("#roles").addEventListener("click", (e) => {
  const b = e.target.closest("[data-role]");
  if (b) selectRole(b.dataset.role);
});

function fieldHTML(f) {
  const id = `f_${f.id}`;
  const req = f.type !== "checkbox" ? ' <span class="req">*</span>' : "";
  let input;
  if (f.type === "textarea") input = `<textarea id="${id}" name="${f.id}" data-min="${f.min || 0}" placeholder="${esc(f.placeholder || "Пиши розгорнуто...")}"></textarea><span class="counter" data-for="${id}">0 / ${f.min || 0}</span>`;
  else if (f.type === "select") input = `<select id="${id}" name="${f.id}"><option value="">— Обери —</option>${f.options.map((o) => `<option>${esc(o)}</option>`).join("")}</select>`;
  else if (f.type === "checkbox") return `<div class="field full" data-field="${f.id}"><label class="checkbox"><input type="checkbox" id="${id}" name="${f.id}" /> <span>${esc(f.label)}</span></label><span class="err"></span></div>`;
  else input = `<input id="${id}" name="${f.id}" type="${f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}" ${f.minVal != null ? `min="${f.minVal}"` : ""} ${f.maxVal != null ? `max="${f.maxVal}"` : ""} placeholder="${esc(f.placeholder || "")}" />`;
  return `<div class="field ${f.full ? "full" : ""}" data-field="${f.id}">
    <label for="${id}">${esc(f.label)}${req}</label>${input}
    ${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ""}<span class="err"></span></div>`;
}

function allFields(roleKey) {
  return [...COMMON_FIELDS.flatMap((g) => g.fields), ...ROLES[roleKey].fields, ...FINAL_FIELDS.fields];
}

function selectRole(key) {
  currentRole = key;
  const r = ROLES[key];
  $$(".role").forEach((b) => b.classList.toggle("active", b.dataset.role === key));
  $("#roleInfo").innerHTML = `
    <span class="role-tag">Заявка на посаду</span>
    <h3 style="color:${r.color}">${r.name}</h3>
    <div><h4>Вимоги</h4><ul>${r.reqs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div><h4>Обов&apos;язки</h4><ul>${r.duties.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    ${r.perksText ? `<p class="muted small">${esc(r.perksText)}</p>` : ""}
    <p class="muted small">Розгляд до 7 днів. Відповідь — у ЛС Discord. Повторна заявка — через 14 днів після відмови.</p>`;
  const groups = [...COMMON_FIELDS, { legend: `Питання для ${r.name}`, fields: r.fields }, FINAL_FIELDS];
  $("#formFields").innerHTML = groups.map((g) => `<fieldset class="fieldset"><legend>${esc(g.legend)}</legend>${g.fields.map(fieldHTML).join("")}</fieldset>`).join("");

  const draft = store.get(`ev_draft_${key}`, null) || {};
  const user = store.get("ev_user", {});
  const prefill = { nick: user.nick, discordName: user.discord, ...draft };
  Object.entries(prefill).forEach(([k, v]) => {
    const el = $(`#f_${k}`);
    if (!el || v == null) return;
    if (el.type === "checkbox") el.checked = !!v; else el.value = v;
  });
  updateProgress();
  $("#applyWrap").hidden = false;
  $("#applyWrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

function readForm() {
  const data = {};
  allFields(currentRole).forEach((f) => {
    const el = $(`#f_${f.id}`);
    if (el) data[f.id] = el.type === "checkbox" ? el.checked : el.value.trim();
  });
  return data;
}

function validateField(f, v) {
  if (f.type === "checkbox") return v ? "" : "Потрібна згода";
  if (!v) return "Обов'язкове поле";
  if (f.min && v.length < f.min) return `Мінімум ${f.min} символів (зараз ${v.length})`;
  if (f.pattern && !new RegExp(f.pattern).test(v)) return f.patternMsg || "Невірний формат";
  if (f.type === "url" && !/^https?:\/\/\S+\.\S+/.test(v)) return "Встав посилання, що починається з https://";
  if (f.type === "number") {
    const n = Number(v);
    if (Number.isNaN(n)) return "Введи число";
    if (f.minVal != null && n < f.minVal) return `Мінімум ${f.minVal}`;
    if (f.maxVal != null && n > f.maxVal) return `Максимум ${f.maxVal}`;
  }
  if (f.id === "age" && Number(v) < ROLES[currentRole].minAge) return `На ${ROLES[currentRole].name} — від ${ROLES[currentRole].minAge} років`;
  return "";
}

function updateProgress() {
  if (!currentRole) return;
  const fields = allFields(currentRole);
  const data = readForm();
  const ok = fields.filter((f) => !validateField(f, data[f.id])).length;
  $("#formProgress").style.width = `${Math.round((ok / fields.length) * 100)}%`;
  $$(".counter").forEach((c) => {
    const ta = $(`#${c.dataset.for}`);
    const min = Number(ta.dataset.min);
    c.textContent = `${ta.value.trim().length} / ${min}`;
    c.classList.toggle("ok", ta.value.trim().length >= min);
  });
}
$("#applyForm").addEventListener("input", (e) => {
  updateProgress();
  const wrap = e.target.closest(".field");
  if (wrap?.classList.contains("invalid")) {
    const f = allFields(currentRole).find((x) => x.id === wrap.dataset.field);
    const msg = validateField(f, readForm()[f.id]);
    if (!msg) { wrap.classList.remove("invalid"); $(".err", wrap).textContent = ""; }
  }
});

$("#saveDraft").addEventListener("click", () => {
  if (!currentRole) return;
  store.set(`ev_draft_${currentRole}`, readForm());
  toast("Чернетку збережено");
});

$("#applyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fields = allFields(currentRole);
  const data = readForm();
  let firstBad = null;
  fields.forEach((f) => {
    const wrap = $(`[data-field="${f.id}"]`);
    const msg = validateField(f, data[f.id]);
    wrap.classList.toggle("invalid", !!msg);
    $(".err", wrap).textContent = msg;
    if (msg && !firstBad) firstBad = wrap;
  });
  if (firstBad) {
    firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
    toast("Заповни всі поля правильно", "error");
    return;
  }
  const apps = store.get("ev_apps", []);
  const recent = apps.find((a) => a.role === currentRole && Date.now() - new Date(a.date) < 864e5);
  if (recent) { toast(`Ти вже подав заявку на ${ROLES[currentRole].name} сьогодні (${recent.code})`, "error"); return; }

  const r = ROLES[currentRole];
  const app = { code: genCode("APP"), role: currentRole, date: new Date().toISOString(), status: "На розгляді", data };
  const text = `**ЗАЯВКА НА ${r.name.toUpperCase()}** · ${app.code}\n` +
    fields.filter((f) => f.type !== "checkbox").map((f) => `**${f.label}:** ${data[f.id]}`).join("\n");
  const submitBtn = $('#applyForm button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  let sent = false;
  try {
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: currentRole, code: app.code,
        values: { nick: data.nick, discordId: data.discordId, age: data.age },
        fields: fields.filter((f) => f.type !== "checkbox").map((f) => ({ label: f.label, value: String(data[f.id] ?? ""), long: f.type === "textarea" })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.status === 429) { toast(ORDER_ERRORS.too_many_requests, "error"); if (submitBtn) submitBtn.disabled = false; return; }
    if (res.status === 400) { toast("Перевір нік, Discord ID та вік у заявці", "error"); if (submitBtn) submitBtn.disabled = false; return; }
    sent = !!d.sent;
  } catch {}
  if (submitBtn) submitBtn.disabled = false;
  apps.unshift(app); store.set("ev_apps", apps);
  store.set("ev_user", { ...store.get("ev_user", {}), nick: data.nick, discord: data.discordName });
  localStorage.removeItem(`ev_draft_${currentRole}`);

  openModal(`
    <div class="success-icon">✓</div>
    <h2 id="modalTitle" style="font-size:30px">Заявку на ${r.name} сформовано</h2>
    <p class="muted">${sent ? "Заявку автоматично надіслано адміністрації в Discord." : "Скопіюй заявку та відправ у канал #заявки (або тікет) на нашому Discord сервері."}</p>
    <div class="instructions">
      <span class="muted small">Номер заявки</span>
      <div class="copy-row"><code>${app.code}</code><button class="btn btn-ghost btn-sm" id="copyCode">Копіювати</button></div>
      <ol><li>Натисни «Копіювати заявку»</li><li>Відкрий Discord і встав у канал заявок</li><li>Чекай відповідь у ЛС до 7 днів</li></ol>
    </div>
    <div class="m-actions">
      <button class="btn btn-fire" id="copyApp">Копіювати заявку</button>
      <a class="btn btn-discord" href="${CONFIG.DISCORD}" target="_blank" rel="noopener">Відкрити Discord</a>
    </div>
  `);
  $("#copyCode").addEventListener("click", () => copyText(app.code));
  $("#copyApp").addEventListener("click", () => copyText(text, "Заявку скопійовано — встав у Discord!"));
  $("#applyForm").reset();
  updateProgress();
});

/* =========================================================
   ПРАВИЛА / FAQ / КАБІНЕТ
   ========================================================= */
function highlight(text, q) {
  const safe = esc(text);
  if (!q) return safe;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return safe.replace(re, "<mark>$1</mark>");
}
const tr = (text) => window.EvilI18n?.translate(text) ?? text;
function renderRules(q = "") {
  const ql = q.toLowerCase();
  const matches = (text) => text.toLowerCase().includes(ql) || tr(text).toLowerCase().includes(ql);
  const html = RULES.map((sec) => {
    const items = sec.items.filter(([, t, p]) => !ql || matches(t) || matches(p));
    if (!items.length) return "";
    return `<details class="acc" ${ql ? "open" : ""}><summary>${esc(sec.title)}</summary><div class="acc-body">
      ${items.map(([n, t, p]) => `<div class="rule"><b>${n}</b><div>${highlight(tr(t), q)}<span class="punish">${esc(tr("Покарання:"))} ${esc(tr(p))}</span></div></div>`).join("")}
    </div></details>`;
  }).join("");
  $("#rulesList").innerHTML = html || `<p class="empty">Нічого не знайдено</p>`;
}
$("#rulesSearch").addEventListener("input", (e) => renderRules(e.target.value.trim()));
document.addEventListener("evil:languagechange", () => renderRules($("#rulesSearch").value.trim()));

function toggleAccordion(acc) {
  const summary = acc.querySelector("summary");
  const body = acc.querySelector(".acc-body");
  const opening = !acc.open;
  acc.getAnimations().forEach((a) => a.cancel());
  body.getAnimations().forEach((a) => a.cancel());
  acc.classList.remove("closing");

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    acc.open = opening;
    return;
  }

  const startHeight = acc.offsetHeight;
  const borders = acc.offsetHeight - acc.clientHeight;
  acc.open = true;
  const endHeight = opening ? acc.offsetHeight : summary.offsetHeight + borders;
  if (!opening) acc.classList.add("closing");

  const timing = { duration: 380, easing: "cubic-bezier(.22,.8,.26,1)" };
  const heightAnim = acc.animate({ height: [`${startHeight}px`, `${endHeight}px`] }, timing);
  body.animate(
    { opacity: opening ? [0, 1] : [1, 0], transform: opening ? ["translateY(-8px)", "none"] : ["none", "translateY(-8px)"] },
    timing
  );
  heightAnim.onfinish = () => {
    acc.open = opening;
    acc.classList.remove("closing");
  };
  heightAnim.oncancel = () => acc.classList.remove("closing");
}
document.addEventListener("click", (e) => {
  const summary = e.target.closest(".acc > summary");
  if (!summary) return;
  e.preventDefault();
  toggleAccordion(summary.parentElement);
});

function renderFaq() {
  $("#faqList").innerHTML = FAQ.map(([q, a]) => `<details class="acc"><summary>${esc(q)}</summary><div class="acc-body"><p>${esc(a)}</p></div></details>`).join("");
}

const LOCALES = { uk: "uk-UA", ru: "ru-RU", en: "en-GB" };
const currentLang = () => window.EvilI18n?.language || "uk";

const ORDER_STATUS_TEXT = (st) => st.status === "cancelled" ? "Скасовано"
  : st.status !== "paid" ? "Очікує оплату"
  : st.delivery === "delivered" || st.delivery === "legacy" ? "Оплачено · видано в грі"
  : st.delivery === "manual" ? "Оплачено · частину видасть адміністрація"
  : st.delivery === "failed" ? "Оплачено · видача уточнюється"
  : "Оплачено · видача в грі (зайди на сервер)";

// Справжній статус замовлень із сайту (оплачено / видано), не лише локальна копія.
let statusRefreshAt = 0;
async function refreshOrderStatuses() {
  const orders = store.get("ev_orders", []);
  if (!orders.length || Date.now() - statusRefreshAt < 15000) return;
  statusRefreshAt = Date.now();
  try {
    const res = await fetch("/api/orders/status?codes=" + encodeURIComponent(orders.slice(0, 30).map((o) => o.code).join(",")), { cache: "no-store" });
    if (!res.ok) return;
    const { orders: statuses } = await res.json();
    let changed = false;
    for (const o of orders) {
      const st = statuses?.[o.code];
      if (!st) continue;
      const text = ORDER_STATUS_TEXT(st);
      if (o.status !== text) { o.status = text; changed = true; }
    }
    if (changed) { store.set("ev_orders", orders); renderProfile(true); }
  } catch { /* офлайн — покажемо збережене */ }
}

function renderProfile(fromRefresh = false) {
  if (!fromRefresh) void refreshOrderStatuses();
  const orders = store.get("ev_orders", []);
  const apps = store.get("ev_apps", []);
  const fmt = (iso) => new Date(iso).toLocaleString(LOCALES[currentLang()] || "uk-UA");
  $("#myOrders").innerHTML = orders.length ? orders.map((o) => `<div class="list-item">
      <div class="row"><b>${esc(o.code)}</b><span class="status">${esc(o.status)}</span></div>
      <span class="muted small">${esc(fmt(o.date))} · ${esc(CONFIG.PAYMENTS[o.method]?.name || "")}</span>
      <span>${o.items.map((i) => esc(i.name)).join(", ")} — <b>${money(o.total)}</b></span>
      ${o.giftTo ? `<span class="muted small">${esc(tr("Подарунок для"))}: <b>${esc(o.giftTo)}</b></span>` : ""}
      <div class="row"><button class="btn btn-ghost btn-sm" data-order="${esc(o.code)}">Реквізити</button></div>
    </div>`).join("") : `<p class="empty">Замовлень ще немає</p>`;
  $("#myApps").innerHTML = apps.length ? apps.map((a) => `<div class="list-item">
      <div class="row"><b>${esc(ROLES[a.role]?.name)} · ${esc(a.code)}</b><span class="status">${esc(a.status)}</span></div>
      <span class="muted small">${esc(fmt(a.date))} · ${esc(a.data.nick)}</span>
    </div>`).join("") : `<p class="empty">Заявок ще немає</p>`;
}
$("#myOrders").addEventListener("click", (e) => {
  const b = e.target.closest("[data-order]");
  if (!b) return;
  const o = store.get("ev_orders", []).find((x) => x.code === b.dataset.order);
  if (o) showPayment(o);
});

/* =========================================================
   ТОП ДОНАТЕРІВ ТА НЕЩОДАВНІ ПОКУПКИ
   ========================================================= */
let feedData = null;

function timeAgo(iso) {
  const diff = (new Date(iso) - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(LOCALES[currentLang()] || "uk-UA", { numeric: "auto" });
  for (const [unit, seconds] of [["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }
  return rtf.format(0, "second");
}

function purchaseName(i) {
  const p = PRODUCTS.find((x) => x.id === i.id);
  const label = dayLabel(i.dur);
  return `${tr(p ? p.name : i.id)}${label ? ` · ${tr(label)}` : ""}${i.qty > 1 ? ` ×${i.qty}` : ""}`;
}

function renderFeed() {
  if (!feedData) return;
  $("#topDonors").innerHTML = feedData.top.length ? feedData.top.map((d, i) => `<li>
      <span class="donor-pos">${i + 1}</span>
      <span class="donor-name"><b>${esc(d.nick)}</b><small>${esc(tr("Покупок:"))} ${d.purchases}</small></span>
      <span class="donor-sum">${money(d.total)}</span>
    </li>`).join("") : `<li class="feed-empty">Поки що порожньо — стань першим!</li>`;
  $("#recentPurchases").innerHTML = feedData.recent.length ? feedData.recent.map((r) => {
    const first = PRODUCTS.find((x) => x.id === r.items[0]?.id);
    const who = r.giftTo ? `${esc(r.nick)} → ${esc(r.giftTo)}` : esc(r.nick);
    const tag = r.giftTo ? `<span class="gift-tag">${esc(tr("Подарунок"))}</span>` : "";
    return `<li>
      <span class="recent-icon">${first ? iconImg(first.id) : ""}</span>
      <span class="recent-main"><b>${who}${tag}</b><small>${esc(r.items.map(purchaseName).join(", "))}</small></span>
      <span class="recent-time">${esc(timeAgo(r.at))}</span>
    </li>`;
  }).join("") : `<li class="feed-empty">Покупок ще не було</li>`;
}

async function loadFeed() {
  try {
    const res = await fetch("/api/feed");
    if (!res.ok) throw new Error("feed " + res.status);
    feedData = await res.json();
  } catch { feedData ||= { top: [], recent: [] }; }
  renderFeed();
}

document.addEventListener("evil:languagechange", () => {
  renderFeed();
  if (!$("#page-profile").hidden) renderProfile();
});

/* =========================================================
   ЕФЕКТИ: іскри, reveal, to-top, пасхалка
   ========================================================= */
function embers() {
  const cv = $("#embers");
  const ctx = cv.getContext("2d");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let w, h, parts = [];
  const resize = () => { w = cv.width = innerWidth; h = cv.height = innerHeight; };
  resize(); addEventListener("resize", resize);
  const count = Math.min(70, Math.floor(innerWidth / 18));
  const spawn = (init) => ({
    x: Math.random() * w, y: init ? Math.random() * h : h + 10,
    s: Math.random() * 3 + 1, vy: Math.random() * 0.8 + 0.3, vx: (Math.random() - 0.5) * 0.4,
    life: Math.random() * 0.6 + 0.4, hue: Math.random() * 40,
  });
  for (let i = 0; i < count; i++) parts.push(spawn(true));
  (function loop() {
    ctx.clearRect(0, 0, w, h);
    parts.forEach((p, i) => {
      p.y -= p.vy; p.x += p.vx + Math.sin(p.y / 40) * 0.2;
      if (p.y < -10) parts[i] = spawn(false);
      ctx.fillStyle = `hsla(${p.hue}, 100%, 55%, ${p.life * (p.y / h)})`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    });
    requestAnimationFrame(loop);
  })();
}

let revealObs;
function observeReveal() {
  if (!("IntersectionObserver" in window)) { $$(".reveal").forEach((el) => el.classList.add("visible")); return; }
  revealObs ||= new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("visible"); revealObs.unobserve(en.target); }
  }), { threshold: 0.12 });
  $$(".reveal:not(.visible)").forEach((el) => revealObs.observe(el));
}

addEventListener("scroll", () => $("#toTop").classList.toggle("show", scrollY > 600), { passive: true });
$("#toTop").addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let kIdx = 0;
document.addEventListener("keydown", (e) => {
  kIdx = e.key === KONAMI[kIdx] ? kIdx + 1 : 0;
  if (kIdx === KONAMI.length) {
    kIdx = 0;
    document.body.classList.add("hell-mode");
    setTimeout(() => document.body.classList.remove("hell-mode"), 1600);
    toast("HELL MODE! Секретний промокод: HELL20 (−20%)");
  }
});

/* =========================================================
   СТАРТ
   ========================================================= */
function rerenderPrices() {
  renderShop();
  renderCompare();
  renderCart();
  renderFeed();
  if (!$("#page-profile").hidden) renderProfile();
}
document.addEventListener("evil:currencychange", rerenderPrices);
document.addEventListener("evil:languagechange", () => { renderShop(); renderCompare(); renderCart(); });

$("#year").textContent = new Date().getFullYear();
renderShop();
renderCompare();
renderRoles();
renderRules();
renderFaq();
renderCart();
embers();
tickCountdown();
setInterval(tickCountdown, 1000);
startStatusPolling();
loadDiscord();
loadFeed();
setInterval(loadFeed, 60000);
showTab(location.hash.slice(1) || "home", false);
