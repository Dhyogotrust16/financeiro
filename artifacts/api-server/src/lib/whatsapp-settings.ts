import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
  webhookUrl?: string | null;
}

export interface EvolutionWebhookResult {
  ok: boolean;
  status: number;
  data: unknown;
  url: string;
}

export type EvolutionWebhookBootstrapResult =
  | EvolutionWebhookResult
  | { ok: false; reason: string };

export const WHATSAPP_SETTINGS_KEY = "global";
export const EVOLUTION_WEBHOOK_EVENTS = [
  "MESSAGES_SET",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "MESSAGES_DELETE",
  "SEND_MESSAGE",
  "CONTACTS_SET",
  "CONTACTS_UPSERT",
  "CONTACTS_UPDATE",
  "CHATS_SET",
  "CHATS_UPSERT",
  "CHATS_UPDATE",
  "CHATS_DELETE",
  "GROUPS_UPSERT",
  "GROUPS_UPDATE",
  "GROUP_PARTICIPANTS_UPDATE",
  "CONNECTION_UPDATE",
] as const;

let ensureTablePromise: Promise<void> | null = null;
const sqlQuery = sql as any;

export function normalizeEvolutionConfig(config: EvolutionConfig): EvolutionConfig {
  return {
    apiUrl: config.apiUrl.trim().replace(/\/+$/, ""),
    apiKey: config.apiKey.trim(),
    instanceName: config.instanceName.trim(),
    webhookUrl: config.webhookUrl?.trim().replace(/\/+$/, "") || null,
  };
}

export function buildEvolutionWebhookPayload(webhookUrl: string) {
  return {
    webhook: {
      enabled: true,
      url: webhookUrl,
      headers: {},
      byEvents: false,
      base64: false,
      events: [...EVOLUTION_WEBHOOK_EVENTS],
    },
  };
}

export async function registerEvolutionWebhook(
  config: EvolutionConfig,
  webhookUrl: string,
): Promise<EvolutionWebhookResult> {
  const normalized = normalizeEvolutionConfig(config);
  const url = `${normalized.apiUrl}/event/webhook/set/${encodeURIComponent(normalized.instanceName)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: normalized.apiKey,
    },
    body: JSON.stringify(buildEvolutionWebhookPayload(webhookUrl)),
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : "";
  } catch {
    data = text;
  }

  return { ok: response.ok, status: response.status, data, url };
}

async function ensureWhatsappSettingsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = db
      .execute(sqlQuery`
        CREATE TABLE IF NOT EXISTS whatsapp_settings (
          setting_key TEXT PRIMARY KEY,
          api_url TEXT NOT NULL,
          api_key TEXT NOT NULL,
          instance_name TEXT NOT NULL,
          webhook_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() =>
        db.execute(sqlQuery`
          ALTER TABLE whatsapp_settings
          ADD COLUMN IF NOT EXISTS webhook_url TEXT
        `),
      )
      .then(() => undefined)
      .catch((err) => {
        ensureTablePromise = null;
        throw err;
      });
  }

  return ensureTablePromise;
}

export async function loadEvolutionConfig(): Promise<EvolutionConfig | null> {
  await ensureWhatsappSettingsTable();

  const rows = (await db.execute(sqlQuery`
    SELECT api_url, api_key, instance_name, webhook_url
    FROM whatsapp_settings
    WHERE setting_key = ${WHATSAPP_SETTINGS_KEY}
    LIMIT 1
  `)) as any[];

  const row = rows[0] as
    | { api_url?: string; api_key?: string; instance_name?: string; webhook_url?: string | null }
    | undefined;

  if (!row?.api_url || !row.api_key || !row.instance_name) {
    return null;
  }

  return normalizeEvolutionConfig({
    apiUrl: row.api_url,
    apiKey: row.api_key,
    instanceName: row.instance_name,
    webhookUrl: row.webhook_url ?? null,
  });
}

export async function saveEvolutionConfig(
  config: EvolutionConfig,
  options: { webhookUrl?: string | null } = {},
): Promise<EvolutionConfig> {
  await ensureWhatsappSettingsTable();
  const normalized = normalizeEvolutionConfig({
    ...config,
    webhookUrl: options.webhookUrl ?? config.webhookUrl ?? null,
  });

  const rows = (await db.execute(sqlQuery`
    INSERT INTO whatsapp_settings (setting_key, api_url, api_key, instance_name, webhook_url, created_at, updated_at)
    VALUES (${WHATSAPP_SETTINGS_KEY}, ${normalized.apiUrl}, ${normalized.apiKey}, ${normalized.instanceName}, ${normalized.webhookUrl ?? null}, NOW(), NOW())
    ON CONFLICT (setting_key) DO UPDATE
    SET api_url = EXCLUDED.api_url,
        api_key = EXCLUDED.api_key,
        instance_name = EXCLUDED.instance_name,
        webhook_url = EXCLUDED.webhook_url,
        updated_at = NOW()
    RETURNING api_url, api_key, instance_name, webhook_url
  `)) as any[];

  const row = rows[0] as
    | { api_url?: string; api_key?: string; instance_name?: string; webhook_url?: string | null }
    | undefined;

  if (!row?.api_url || !row.api_key || !row.instance_name) {
    return normalized;
  }

  return normalizeEvolutionConfig({
    apiUrl: row.api_url,
    apiKey: row.api_key,
    instanceName: row.instance_name,
    webhookUrl: row.webhook_url ?? null,
  });
}

export async function resolveEvolutionConfig(): Promise<EvolutionConfig | null> {
  const stored = await loadEvolutionConfig();
  if (stored) {
    return stored;
  }

  const apiUrl = process.env.EVOLUTION_API_URL?.trim() ?? "";
  const apiKey = process.env.EVOLUTION_API_KEY?.trim() ?? "";
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME?.trim() ?? "";

  if (!apiUrl || !apiKey || !instanceName) {
    return null;
  }

  return normalizeEvolutionConfig({ apiUrl, apiKey, instanceName });
}

export function resolveEvolutionWebhookBaseUrl(fallbackPort?: number) {
  const configured =
    process.env.WHATSAPP_WEBHOOK_BASE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.PUBLIC_URL?.trim() ||
    "";

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const port = Number(process.env.PORT ?? fallbackPort ?? 4000);
  return `http://localhost:${Number.isFinite(port) && port > 0 ? port : 4000}`;
}

export function buildEvolutionWebhookUrl(instanceName: string, baseUrl?: string) {
  const base = (baseUrl?.trim() || resolveEvolutionWebhookBaseUrl()).replace(/\/+$/, "");
  return `${base}/api/whatsapp/webhook/${encodeURIComponent(instanceName)}`;
}

export async function bootstrapEvolutionWebhook(
  fallbackPort?: number,
): Promise<EvolutionWebhookBootstrapResult> {
  const config = await loadEvolutionConfig();
  if (!config || !config.apiUrl || !config.apiKey || !config.instanceName) {
    return { ok: false, reason: "Evolution API configuration not found" };
  }

  const webhookUrl = config.webhookUrl?.trim() || buildEvolutionWebhookUrl(config.instanceName, resolveEvolutionWebhookBaseUrl(fallbackPort));
  return registerEvolutionWebhook(config, webhookUrl);
}
