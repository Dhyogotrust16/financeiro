import { pgTable, text, serial, timestamp, numeric, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const payablesTable = pgTable("payables", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  categoryId: integer("category_id"),
  status: text("status").notNull().default("pendente"),
  paidAt: date("paid_at", { mode: "string" }),
  expenseId: integer("expense_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPayableSchema = createInsertSchema(payablesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayable = z.infer<typeof insertPayableSchema>;
export type Payable = typeof payablesTable.$inferSelect;
