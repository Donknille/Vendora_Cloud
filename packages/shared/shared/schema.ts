import { sql } from "drizzle-orm";
import { boolean, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  supabase_id: text("supabase_id").unique("users_supabase_id_key"),
  email: text("email").notNull().unique("users_email_key"),
  revenuecat_app_user_id: text("revenuecat_app_user_id").unique(
    "users_revenuecat_app_user_id_key",
  ),
  subscription_status: text("subscription_status").default("trialing"),
  subscription_expires_at: text("subscription_expires_at"),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  supabase_id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.supabase_id, { onDelete: "cascade" }),
  customer_name: text("customer_name").notNull(),
  customer_email: text("customer_email"),
  customer_address: text("customer_address"),
  status: text("status").notNull(),
  invoice_number: text("invoice_number"),
  notes: text("notes"),
  order_date: text("order_date").notNull(),
  service_date: text("service_date"),
  shipping_cost: text("shipping_cost"),
  total: text("total"),
  created_at: text("created_at"),
  updated_at: text("updated_at"),
});

export const order_items = pgTable("order_items", {
  id: varchar("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.supabase_id, { onDelete: "cascade" }),
  order_id: varchar("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: text("quantity").notNull(),
  price: text("price").notNull(),
  notes: text("notes"),
  is_completed: boolean("is_completed").default(false),
});

export const markets = pgTable("markets", {
  id: varchar("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.supabase_id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  date: text("date").notNull(),
  location: text("location"),
  stand_fee: text("stand_fee"),
  travel_cost: text("travel_cost"),
  notes: text("notes"),
  quick_items: text("quick_items"),
  status: text("status"),
  created_at: text("created_at"),
});

export const market_sales = pgTable("market_sales", {
  id: varchar("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.supabase_id, { onDelete: "cascade" }),
  market_id: varchar("market_id")
    .notNull()
    .references(() => markets.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: text("amount").notNull(),
  quantity: text("quantity").notNull(),
  created_at: text("created_at"),
});

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.supabase_id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: text("amount").notNull(),
  category: text("category").notNull(),
  date: text("date").notNull(),
  expense_date: text("expense_date"),
  created_at: text("created_at"),
});

export const insertOrderSchema = createInsertSchema(orders);
export const insertOrderItemSchema = createInsertSchema(order_items);
export const insertMarketSchema = createInsertSchema(markets);
export const insertMarketSaleSchema = createInsertSchema(market_sales);
export const insertExpenseSchema = createInsertSchema(expenses);
