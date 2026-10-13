import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export type OrderItem = { id: string; dur: "30" | "forever" | ""; qty: number; unit: number }

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nick: text("nick").notNull(),
  discord: text("discord").notNull(),
  method: text("method").notNull(),
  items: jsonb("items").$type<OrderItem[]>().notNull(),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull().default(0),
  total: integer("total").notNull(),
  promo: text("promo"),
  giftTo: text("gift_to"),
  giftMessage: text("gift_message"),
  status: text("status").notNull().default("pending"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
})
