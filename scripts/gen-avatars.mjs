import { mkdirSync, writeFileSync } from "node:fs"

const OUT = new URL("../public/avatars/", import.meta.url)
mkdirSync(OUT, { recursive: true })

const SIZE = 16

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const blank = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null))

function fromGrid(rows, palette, dither = {}, seed = 1) {
  const rand = rng(seed)
  const g = blank()
  rows.forEach((row, y) => {
    if (row.length !== SIZE) throw new Error(`row ${y} has length ${row.length}: "${row}"`)
    ;[...row].forEach((ch, x) => {
      if (ch === ".") return
      const options = dither[ch]
      g[y][x] = options ? options[Math.floor(rand() * options.length)] : palette[ch]
    })
  })
  return g
}

function toSvg(grid, bg) {
  const rects = []
  grid.forEach((row, y) => {
    let x = 0
    while (x < SIZE) {
      const color = row[x]
      if (!color) { x++; continue }
      let run = 1
      while (x + run < SIZE && row[x + run] === color) run++
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${color}"/>`)
      x += run
    }
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="512" height="512" shape-rendering="crispEdges">${bg}${rects.join("")}</svg>\n`
}

const bgRadial = (inner, outer) =>
  `<defs><radialGradient id="g" cx="50%" cy="55%" r="75%"><stop offset="0" stop-color="${inner}"/><stop offset="1" stop-color="${outer}"/></radialGradient></defs><rect width="16" height="16" fill="url(#g)"/>`

/* 1. Demon head */
const demon = fromGrid(
  [
    "................",
    "..h..........h..",
    "..hh........hh..",
    "..hhh......hhh..",
    "...hhkkkkkkhh...",
    "...kkrrrrrrkk...",
    "..krrrrrrrrrrk..",
    "..kryyrrrryyrk..",
    "..krybrrrrbyrk..",
    "..krrrrrrrrrrk..",
    "..krrrkrrkrrrk..",
    "...krrrrrrrrk...",
    "...kwkwkwkwkk...",
    "...kkwkwkwkkk...",
    "....kkkkkkkk....",
    "................",
  ],
  { k: "#1a0505", h: "#e8d2a8", y: "#ffd23f", b: "#0a0404", w: "#fff3d6" },
  { r: ["#d4251a", "#d4251a", "#c21f16", "#e0301f"] },
  7,
)

/* 2. Lava block with letter E */
function lavaBlockE() {
  const rand = rng(21)
  const lava = ["#ff6a00", "#ff8a1f", "#ffb02e", "#e24a00", "#ff6a00", "#ff7d10"]
  const g = blank()
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) g[y][x] = lava[Math.floor(rand() * lava.length)]
  for (let i = 0; i < SIZE; i++) {
    g[0][i] = "#ffd28a"
    g[i][0] = "#ffd28a"
    g[SIZE - 1][i] = "#5a1a05"
    g[i][SIZE - 1] = "#5a1a05"
  }
  const glyph = ["#####", "#....", "#....", "####.", "#....", "#....", "#####"]
  const ox = 5
  const oy = 4
  glyph.forEach((row, gy) =>
    [...row].forEach((ch, gx) => {
      if (ch !== "#") return
      g[oy + gy + 1][ox + gx + 1] = "#7a1d00"
    }),
  )
  glyph.forEach((row, gy) =>
    [...row].forEach((ch, gx) => {
      if (ch === "#") g[oy + gy][ox + gx] = "#1a0505"
    }),
  )
  return g
}

/* 3. Creeper-style demon */
const creeper = fromGrid(
  [
    "................",
    ".hh..........hh.",
    ".hhh........hhh.",
    "..hhrrrrrrrrhh..",
    "..rrrrrrrrrrrr..",
    "..rbbbrrrrbbbr..",
    "..rbobrrrrbobr..",
    "..rbbbbbbbbbbr..",
    "..rrrbbbbbbrrr..",
    "..rrrbbbbbbrrr..",
    "..rrrbbrrbbrrr..",
    "..rrrbbrrbbrrr..",
    "..rrrrrrrrrrrr..",
    "..RRrrrrrrrrRR..",
    "................",
    "................",
  ],
  { h: "#e8d2a8", b: "#120505", o: "#ffb02e" },
  { r: ["#e0301f", "#d4251a", "#ff4a24", "#c21f16"], R: ["#8a1410", "#9c1a12"] },
  11,
)

/* 4. Flaming skull */
const skull = fromGrid(
  [
    "................",
    "....o......o....",
    "...oyo....oyo...",
    "...kwwwwwwwwk...",
    "..kwwwwwwwwwwk..",
    "..kwwwwwwwwwwk..",
    "..kwbbbwwbbbwk..",
    "..kwbobwwbobwk..",
    "..kwbbbwwbbbwk..",
    "..kwwwwkkwwwwk..",
    "...kwwwwwwwwk...",
    "...kwkwkwkwkwk..",
    "....kwkwkwkwk...",
    "....kkkkkkkkk...",
    "................",
    "................",
  ],
  { k: "#1a0f0a", w: "#f2e6c8", b: "#0a0404", o: "#ff6a00", y: "#ffd23f" },
  {},
  3,
)

/* 5. Hell gate */
function hellGate() {
  const rand = rng(55)
  const g = blank()
  const obs = ["#1b1030", "#2a1646", "#120a20", "#1b1030"]
  for (let y = 1; y <= 14; y++)
    for (let x = 2; x <= 13; x++) {
      const inner = x >= 4 && x <= 11 && y >= 3 && y <= 12
      if (inner) {
        const t = (y - 3) / 9
        const fire = t < 0.35 ? ["#ffd23f", "#ffb02e", "#ff8a1f"] : t < 0.7 ? ["#ff8a1f", "#ff6a00", "#e24a00"] : ["#e24a00", "#c21f16", "#8a1410"]
        g[y][x] = fire[Math.floor(rand() * fire.length)]
      } else {
        g[y][x] = rand() < 0.1 ? "#7b2fd0" : obs[Math.floor(rand() * obs.length)]
      }
    }
  for (let y = 4; y <= 11; y += 2) g[y][7 + (y % 4 === 0 ? 0 : 1)] = "#fff3d6"
  return g
}

const variants = [
  { name: "option-1-demon", label: "Демон", grid: demon, bg: bgRadial("#4a0a08", "#0a0404") },
  { name: "option-2-lava-e", label: "Лавовий блок E", grid: lavaBlockE(), bg: "" },
  { name: "option-3-creeper", label: "Криперо-демон", grid: creeper, bg: bgRadial("#3a0d06", "#0a0404") },
  { name: "option-4-skull", label: "Палаючий череп", grid: skull, bg: bgRadial("#3b0f06", "#050202") },
  { name: "option-5-gate", label: "Пекельні врата", grid: hellGate(), bg: bgRadial("#2a1030", "#07040c") },
]

for (const v of variants) {
  const svg = toSvg(v.grid, v.bg)
  writeFileSync(new URL(`${v.name}.svg`, OUT), svg)
}

let sharp = null
try {
  sharp = (await import("sharp")).default
} catch {}
if (sharp) {
  for (const v of variants) {
    const svg = toSvg(v.grid, v.bg)
    await sharp(Buffer.from(svg), { density: 72 }).resize(512, 512, { kernel: "nearest" }).png().toFile(new URL(`${v.name}.png`, OUT).pathname)
  }
}
console.log(`generated ${variants.length} avatars${sharp ? " (svg + png)" : " (svg only)"}`)
