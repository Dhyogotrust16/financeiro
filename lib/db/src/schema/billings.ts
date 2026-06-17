import { pgTable, text, serial, timestamp, numeric, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const billingsTable = pgTable("billings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  clientId: integer("client_id"),
  description: text("description").notNull().default(""),
  categoryId: integer("category_id"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  monthlyFee: numeric("monthly_fee", { precision: 12, scale: 2 }).notNull(),
  expensesTotal: numeric("expenses_total", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pendente"),
  paidAt: date("paid_at", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const billingItemsTable = pgTable("billing_items", {
  id: serial("id").primaryKey(),
  billingId: integer("billing_id").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  itemType: text("item_type").notNull(),
  expenseId: integer("expense_id"),
});

export const insertBillingSchema = createInsertSchema(billingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBilling = z.infer<typeof insertBillingSchema>;
export type Billing = typeof billingsTable.$inferSelect;

export const insertBillingItemSchema = createInsertSchema(billingItemsTable).omit({ id: true });
export type InsertBillingItem = z.infer<typeof insertBillingItemSchema>;
export type BillingItem = typeof billingItemsTable.$inferSelect;
