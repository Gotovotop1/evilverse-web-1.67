import re, sys

P = "/vercel/share/v0-project/public/index.js"
s = open(P, encoding="utf-8").read()


def rep(old, new, count=1):
    global s
    if s.count(old) < 1:
        sys.exit("NOT FOUND: " + old[:90])
    s = s.replace(old, new, count)


def between(start, end, new):
    global s
    a = s.find(start)
    if a < 0:
        sys.exit("START NOT FOUND: " + start[:90])
    b = s.find(end, a)
    if b < 0:
        sys.exit("END NOT FOUND: " + end[:90])
    s = s[:a] + new + s[b:]


# ---- A. config ----
rep("""  // Discord webhook для автоматичної відправки заявок і замовлень у канал (необов'язково).
  // Server Settings → Integrations → Webhooks → New Webhook → Copy URL
  WEBHOOK_URL: "",
""", """  VERSIONS: "1.8 – 26.2",
""")
rep("""    // available: false вимикає спосіб; region: показувати лише для цієї мови сайту (без region — для всіх)
""", """    // Усі способи показуються завжди, незалежно від мови. available: false — спосіб видно, але вибрати не можна.
""")
rep('region: "ru", ', "", 2)
rep('  PROMO: { EVIL10: 10, START15: 15, HELL20: 20 },\n', "")

# ---- B. perks ----
rep('"15 точок дому", "Свій колір ніку"]', '"15 точок дому", "Свій колір ніку", "Знижка 10% на кейси"]')
rep('"Пріоритетна підтримка", "Голос у розвитку сервера"]', '"Пріоритетна підтримка", "Знижка 25% на кейси", "Голос у розвитку сервера"]')

# ---- C. loot ----
rep("const EXTRAS = [", r'''const RARITY = {
  common: { name: "Звичайні", color: "#9fb3c8" },
  rare: { name: "Рідкісні", color: "#4aa3ff" },
  epic: { name: "Епічні", color: "#b04aff" },
  legendary: { name: "Легендарні", color: "#ffd23f" },
};

// [назва, рідкість, шанс у %]. Сума для кожного кейса = 100. Шанси чорнові — підлаштуємо разом.
const CASE_LOOT = {
  c_hell: [
    ["Залізні злитки ×16", "common", 25], ["Золоті злитки ×16", "common", 20], ["Золоті яблука ×4", "common", 15],
    ["Алмази ×8", "rare", 14], ["Зачарована книга (Захист IV)", "rare", 8], ["50–100 токенів", "rare", 5],
    ["Уламки незериту ×4", "epic", 6], ["150–300 токенів", "epic", 4], ["Зачарований алмазний меч", "epic", 2],
    ["Привілей Біс", "legendary", 1],
  ],
  c_demon: [
    ["Алмази ×12", "common", 20], ["Золоті яблука ×8", "common", 15], ["Зачарована книга (Міцність III)", "common", 10],
    ["Тотем безсмертя", "rare", 12], ["200–400 токенів", "rare", 12], ["Уламки незериту ×6", "rare", 8],
    ["Зачарована незеритова кирка", "epic", 8], ["Незеритовий меч", "epic", 6], ["400–800 токенів", "epic", 6],
    ["Привілей Цербер", "legendary", 3],
  ],
  c_vladyka: [
    ["Незеритові злитки ×4", "common", 15], ["Тотем безсмертя", "common", 12], ["300–600 токенів", "common", 8],
    ["Алмазна броня (Захист IV)", "rare", 12], ["500–900 токенів", "rare", 11], ["Уламки незериту ×16", "rare", 10],
    ["Зачаровані незеритові інструменти", "epic", 10], ["1000–2000 токенів", "epic", 7], ["Елітри", "epic", 5],
    ["Повний незеритовий сет", "legendary", 5], ["Привілей Демон", "legendary", 5],
  ],
};

const EXTRAS = [''')

# ---- E. remove client webhook ----
between("async function sendWebhook(payload) {", "/* =========================================================\n   РОУТИНГ ВКЛАДОК", "")

# ---- F. status version ----
rep('''      const v = String(d.version || "").replace(/[^\\d.\\-–x ]/g, "").trim();
      $("#statVersion").textContent = v ? v.split(" ")[0] : "Java";''', '''      $("#statVersion").textContent = CONFIG.VERSIONS;''')
rep('''      $("#statVersion").textContent = "Java";
    }''', '''      $("#statVersion").textContent = CONFIG.VERSIONS;
    }''')
a = s.index('  ["Яка версія сервера?", ')
b = s.index("\n", a)
s = s[:a] + '  ["Яка версія сервера?", "Java Edition. Сервер працює на версіях від 1.8 до 26.2 — заходь з будь-якої з них."],' + s[b:]

# ---- G. countdown in Kyiv time ----
between("function nextSaturday18() {", "function tickCountdown() {", r'''const KYIV_FORMAT = (() => {
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
''')

# ---- H. product modal: loot + gift ----
rep("    ${perks}\n    ${options}", "    ${perks}\n    ${p.cat === \"case\" ? lootHTML(p.id) : \"\"}\n    ${options}")
rep('''      <button class="btn btn-ghost" id="addCart">У кошик</button>
      <button class="btn btn-fire" id="buyNow">Купити зараз</button>
    </div>
  `);''', '''      <button class="btn btn-ghost" id="addCart">У кошик</button>
      <button class="btn btn-ghost" id="giftNow">Подарувати другу</button>
      <button class="btn btn-fire" id="buyNow">Купити зараз</button>
    </div>
  `);''')
rep('''  $("#buyNow").addEventListener("click", () => { add(); closeModal(); openCheckout(); });
}''', '''  $("#buyNow").addEventListener("click", () => { add(); closeModal(); openCheckout(); });
  $("#giftNow").addEventListener("click", () => { add(); closeModal(); openCheckout({ gift: true }); });
  if (p.cat === "case") initRoll(p.id);
}

const fmtChance = (n) => (Number.isInteger(n) ? n : n.toFixed(1)) + "%";

function lootHTML(id) {
  const loot = CASE_LOOT[id];
  if (!loot) return "";
  const groups = Object.entries(RARITY)
    .map(([key, meta]) => ({ key, meta, items: loot.filter((l) => l[1] === key) }))
    .filter((g) => g.items.length)
    .map((g) => ({ ...g, sum: g.items.reduce((acc, l) => acc + l[2], 0) }));
  const bar = groups.map((g) => `<span style="width:${g.sum}%;background:${g.meta.color}"></span>`).join("");
  const list = groups.map((g) => `<div class="loot-group" style="--rar:${g.meta.color}">
      <h4><span>${esc(g.meta.name)}</span><span>${fmtChance(g.sum)}</span></h4>
      ${g.items.map((l) => `<div class="loot-row"><span>${esc(l[0])}</span><b>${fmtChance(l[2])}</b></div>`).join("")}
    </div>`).join("");
  const preview = loot.slice(0, 6).map((l) => `<div class="roll-cell" style="--rar:${RARITY[l[1]].color}"><span>${esc(l[0])}</span></div>`).join("");
  return `<div class="loot">
    <div class="loot-title"><span>Що може випасти</span><span class="muted small">Шанси дропу</span></div>
    <div class="loot-bar" aria-hidden="true">${bar}</div>
    ${list}
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
    strip.innerHTML = cells.map((c) => `<div class="roll-cell" style="--rar:${RARITY[c[1]].color}"><span>${esc(tr(c[0]))}</span></div>`).join("");
    const target = stop * cellW + cellW / 2 - $(".roll-window").clientWidth / 2 + (Math.random() * 60 - 30);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    void strip.offsetWidth;
    strip.style.transition = reduced ? "none" : "transform 4.2s cubic-bezier(.12,.7,.1,1)";
    strip.style.transform = `translateX(${-target}px)`;
    const done = () => {
      result.style.color = RARITY[winner[1]].color;
      result.textContent = `${tr("Випало:")} ${tr(winner[0])} · ${fmtChance(winner[2])}`;
      btn.disabled = false;
    };
    if (reduced) done(); else setTimeout(done, 4300);
  });
}''')

# ---- I. cart / promo ----
rep('let promo = store.get("ev_promo", null);', 'let promo = store.get("ev_promo", null);\nlet promoPct = store.get("ev_promo_pct", 0);')
rep('function saveCart() { store.set("ev_cart", cart); store.set("ev_promo", promo); renderCart(); }',
    'function saveCart() { store.set("ev_cart", cart); store.set("ev_promo", promo); store.set("ev_promo_pct", promoPct); renderCart(); }')
rep("const pct = promo ? CONFIG.PROMO[promo] || 0 : 0;", "const pct = promo ? promoPct : 0;")
between('$("#promoApply").addEventListener("click", () => {', '$("#promoInput").addEventListener("keydown"', r'''$("#promoApply").addEventListener("click", async () => {
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
''')

# ---- J. checkout ----
between("/* ---------- Checkout ---------- */", "function showPayment(o) {", r'''/* ---------- Checkout ---------- */
const NICK_RE = /^[A-Za-z0-9_]{3,16}$/;
const ORDER_ERRORS = {
  bad_nick: "Нік: 3–16 символів (латиниця, цифри, _)",
  bad_gift_nick: "Нік отримувача: 3–16 символів, і це не твій нік",
  bad_discord: "Вкажи свій Discord",
  bad_method: "Обери доступний спосіб оплати",
  bad_promo: "Такого промокоду не існує",
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
      <label class="checkbox"><input type="checkbox" id="coAgree" /> <span>Я погоджуюсь з правилами донату (п. 5) та розумію, що видача відбувається через тікет у Discord</span></label>
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
          items: cart.map((c) => ({ id: c.id, qty: c.qty, dur: c.cat === "rank" ? (c.label === "30 днів" ? "30" : "forever") : undefined })),
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
        code: d.code, nick, discord, method, total: d.total, promo: d.promo,
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
  return `Замовлення ${o.code}\nНік: ${o.nick}\nDiscord: ${o.discord}${gift}\nТовари: ${o.items.map((i) => `${i.name}${i.label ? " (" + i.label + ")" : ""} x${i.qty}`).join(", ")}\nСума: ${money(o.total)}\nОплата: ${CONFIG.PAYMENTS[o.method].name}`;
}

''')
rep('''    <p class="muted">Оплата: ${esc(m.name)}</p>
    <div class="instructions">''', '''    <p class="muted">Оплата: ${esc(m.name)}</p>
    ${o.giftTo ? `<div class="gift-card"><span class="muted small">Подарунок для</span><br><b>${esc(o.giftTo)}</b>${o.giftMessage ? `<p>«${esc(o.giftMessage)}»</p>` : ""}</div>` : ""}
    <div class="instructions">''')

# ---- K. applications through server ----
between('  const r = ROLES[currentRole];\n  const app = {', '  openModal(`\n    <div class="success-icon">✓</div>\n    <h2 id="modalTitle" style="font-size:30px">Заявку на ${r.name}', r'''  const r = ROLES[currentRole];
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

''')

# ---- L. profile ----
between("function renderProfile() {", "$(\"#myOrders\").addEventListener(\"click\"", r'''const LOCALES = { uk: "uk-UA", ru: "ru-RU", en: "en-GB" };
const currentLang = () => window.EvilI18n?.language || "uk";

function renderProfile() {
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
''')

# ---- M. corrupted characters ----
s = s.replace("хелперо\ufffd\ufffd", "хелпером")

# ---- N. feed ----
rep('''/* =========================================================
   ЕФЕКТИ: іскри, reveal, to-top, пасхалка''', r'''/* =========================================================
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
   ЕФЕКТИ: іскри, reveal, to-top, пасхалка''')
rep("  startStatusPolling();\n  loadDiscord();", "startStatusPolling();\nloadDiscord();\nloadFeed();\nsetInterval(loadFeed, 60000);")

open(P, "w", encoding="utf-8").write(s)
print("patched, bytes:", len(s))
