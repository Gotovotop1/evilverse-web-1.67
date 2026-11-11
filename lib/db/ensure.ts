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
      -- Автоматична оплата через банку monobank
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_log jsonb;
      CREATE TABLE IF NOT EXISTS mono_payments (
        id text PRIMARY KEY,
        code text,
        amount integer NOT NULL,
        comment text,
        paid_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS pay_amount text;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS pay_link text;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS prefix_status text;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS prefix_note text;
      CREATE TABLE IF NOT EXISTS crypto_payments (
        id text PRIMARY KEY,
        network text NOT NULL,
        code text,
        amount bigint NOT NULL,
        comment text,
        paid_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS app_kv (key text PRIMARY KEY, value text NOT NULL);
      -- Лічильник захисту від спаму (замовлення, заявки) — спільний для всіх копій сайту на Vercel
      CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY, window_start timestamptz NOT NULL, hits integer NOT NULL);
      -- Голоси з моніторингів: один голос з моніторингу на нік за добу (day — дата за Києвом)
      CREATE TABLE IF NOT EXISTS votes (
        id serial PRIMARY KEY,
        site text NOT NULL,
        nick text NOT NULL,
        day text NOT NULL,
        order_code text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS votes_once_a_day ON votes (site, lower(nick), day);
    `)
    .then(() => undefined)
    .catch((error) => {
      ready = null
      throw error
    })
  return ready
}
