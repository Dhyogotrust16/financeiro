import { pgTable, text, serial, timestamp, numeric, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const revenuesTable = pgTable("revenues", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  clientId: integer("client_id"),
  date: date("date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method"),
  status: text("status").notNull().default("pendente"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRevenueSchema = createInsertSchema(revenuesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRevenue = z.infer<typeof insertRevenueSchema>;
export type Revenue = typeof revenuesTable.$inferSelect;
