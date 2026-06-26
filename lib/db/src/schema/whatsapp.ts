import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const whatsappSettingsTable = pgTable("whatsapp_settings", {
  settingKey: text("setting_key").primaryKey(),
  apiUrl: text("api_url").notNull(),
  apiKey: text("api_key").notNull(),
  instanceName: text("instance_name").notNull(),
  webhookUrl: text("webhook_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type WhatsAppSettings = typeof whatsappSettingsTable.$inferSelect;
