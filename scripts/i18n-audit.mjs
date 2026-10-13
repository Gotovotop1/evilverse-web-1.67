import { readFileSync } from "node:fs"
import vm from "node:vm"

const root = new URL("../public/", import.meta.url)
const read = (f) => readFileSync(new URL(f, root), "utf8")

function loadTranslator(lang) {
  const noop = () => {}
  const element = () => ({
    addEventListener: noop, setAttribute: noop, getAttribute: () => null, hasAttribute: () => false,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    querySelectorAll: () => [], querySelector: () => null, appendChild: noop, style: {},
  })
  const sandbox = {
    console,
    localStorage: { getItem: () => lang, setItem: noop },
    navigator: { languages: [lang], language: lang },
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    NodeFilter: { SHOW_TEXT: 4 },
    MutationObserver: class { observe() {} },
    document: {
      documentElement: { lang, classList: { add: noop, remove: noop } },
      body: element(),
      title: "",
      querySelector: () => null,
      querySelectorAll: () => [],
      createTreeWalker: () => ({ nextNode: () => false }),
      createElement: element,
      addEventListener: noop,
      dispatchEvent: noop,
    },
    CustomEvent: class {},
    setTimeout, clearTimeout,
  }
  sandbox.window = sandbox
  vm.createContext(sandbox)
  vm.runInContext(read("i18n-extra.js"), sandbox)
  vm.runInContext(read("i18n.js").replace("window.EvilI18n = {", "window.__dict = translations; window.EvilI18n = {"), sandbox)
  return { translate: sandbox.window.EvilI18n.translate, dict: sandbox.window.__dict[lang] }
}

const decode = (t) => t.replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")

function segmentsFromHtmlLike(text) {
  return decode(text.replace(/\$\{[^}]*\}/g, "\n").replace(/<[^>]*>/g, "\n"))
    .split("\n").map((t) => t.trim()).filter((t) => /[А-Яа-яІіЇїЄєҐґ]/.test(t))
}

function jsStrings(code) {
  const out = []
  const re = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g
  let m
  while ((m = re.exec(code))) {
    const raw = m[1] ?? m[2] ?? m[3]
    if (!/[А-Яа-яІіЇїЄєҐґ]/.test(raw)) continue
    out.push(...segmentsFromHtmlLike(raw.replace(/\\n/g, "\n").replace(/\\'/g, "'").replace(/\\"/g, '"')))
  }
  return out
}

const html = read("index.html").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "")
const htmlAttrs = [...html.matchAll(/(?:placeholder|aria-label|title|alt)="([^"]*)"/g)].map((m) => m[1])
const sources = {
  html: segmentsFromHtmlLike(html).concat(htmlAttrs.flatMap(segmentsFromHtmlLike)),
  js: jsStrings(read("index.js")),
}

let failed = 0
for (const lang of ["ru", "en"]) {
  const { translate, dict } = loadTranslator(lang)
  const missing = new Set()
  for (const list of Object.values(sources))
    for (const text of list) {
      if ((text.match(/[А-Яа-яІіЇїЄєҐґ]/g) || []).length < 2) continue
      if (text in dict) continue
      if (translate(text) === text) missing.add(text)
    }
  console.log(`\n== ${lang}: ${missing.size} untranslated`)
  for (const t of missing) console.log("  " + JSON.stringify(t))
  failed += missing.size
}
process.exit(failed ? 1 : 0)
