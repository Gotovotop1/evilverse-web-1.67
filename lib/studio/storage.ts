/*
 * EvilVerse Studio — где лежат готовые ролики до публикации.
 * © 2026 EvilVerse (evilverse.lol). Все права защищены.
 *
 * На Vercel — Vercel Blob (браузер грузит файл напрямую, минуя функцию сайта).
 * Для проверки на своём компьютере (STUDIO_STORAGE=local) — папка на диске.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { env } from "./core"

export const storageMode = (): "blob" | "local" | null =>
  env("STUDIO_STORAGE") === "local" ? "local" : env("BLOB_READ_WRITE_TOKEN") ? "blob" : null

const DIR = () => env("STUDIO_LOCAL_DIR") || "/tmp/evs-studio-blobs"
const safe = (name: string) => name.replace(/[^\w.-]/g, "").slice(0, 120)

export async function localSave(name: string, data: Uint8Array) {
  await mkdir(DIR(), { recursive: true })
  await writeFile(path.join(DIR(), safe(name)), data)
}
export async function localRead(name: string) { return readFile(path.join(DIR(), safe(name))) }
export async function localDelete(url: string) { const name = url.split("/").pop() ?? ""; await rm(path.join(DIR(), safe(name)), { force: true }) }
