import { pool } from "./index"

// Додає колонки автовидачі до вже існуючої таблиці orders (безпечно: IF NOT EXISTS, нічого не видаляє).
// delivery_status: NULL — чекає видачі; delivered | manual | failed — результат від сервера; legacy — до автовидачі.
let ready: Promise<void> | null = null

export function ensureDeliveryColumns() {
  ready ??= pool
    .query(`
      -- Замовлення, створені ДО автовидачі, вже видані вручну: позначаємо їх 'legacy', щоб сервер не видав їх удруге.
      -- (DEFAULT спрацьовує лише в момент створення колонки, потім його прибираємо — нові замовлення = NULL.)
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'legacy';
      ALTER TABLE orders ALTER COLUMN delivery_status DROP DEFAULT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_log jsonb;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_manual jsonb;
      CREATE INDEX IF NOT EXISTS orders_delivery_pending ON orders (status, delivery_status);
    `)
    .then(() => undefined)
    .catch((error) => {
      ready = null
      throw error
    })
  return ready
}
