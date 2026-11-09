import { pool } from "./index"

// Додає колонки автовидачі до вже існуючої таблиці orders (безпечно: IF NOT EXISTS, нічого не видаляє).
// delivery_status: NULL — чекає видачі; delivered | manual | failed — результат від сервера; legacy — до автовидачі.
let ready: Promise<void> | null = null

export function ensureDeliveryColumns() {
  ready ??= pool
    .query(`
      -- Нова (порожня) база: створюємо таблицю замовлень. Якщо таблиця вже є — нічого не змінюється.
      CREATE TABLE IF NOT EXISTS orders (
        id serial PRIMARY KEY,
        code text NOT NULL UNIQUE,
        nick text NOT NULL,
        discord text NOT NULL,
        method text NOT NULL,
        items jsonb NOT NULL,
        subtotal integer NOT NULL,
        discount integer NOT NULL DEFAULT 0,
        total integer NOT NULL,
        promo text,
        gift_to text,
        gift_message text,
        status text NOT NULL DEFAULT 'pending',
        is_demo boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        paid_at timestamptz,
        delivery_status text,
        delivered_at timestamptz,
        delivery_log jsonb,
        delivery_manual jsonb
      );
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
