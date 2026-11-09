import { pool } from "@/lib/db"

// Маленьке сховище «ключ → значення» в базі (таблиця app_kv): стан перевірок оплат, курс валют тощо.
export async function kvGet(key: string) {
  const r = await pool.query("SELECT value FROM app_kv WHERE key = $1", [key])
  return (r.rows[0]?.value as string | undefined) ?? null
}

export async function kvSet(key: string, value: string) {
  await pool.query("INSERT INTO app_kv (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", [key, value])
}

/** Атомарний «замок за часом»: true не частіше ніж раз на intervalMs на всі копії сайту одразу. */
export async function takeSlot(key: string, intervalMs: number) {
  const now = Date.now()
  const r = await pool.query(
    `INSERT INTO app_kv (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2 WHERE app_kv.value::bigint <= $3
     RETURNING key`,
    [key, String(now), now - intervalMs],
  )
  return r.rowCount === 1
}
