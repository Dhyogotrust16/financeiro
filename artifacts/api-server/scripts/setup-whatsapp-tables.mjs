import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vpzdndtrsrpnslwlsfxe.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwemRuZHRyc3JwbnNsd2xzZnhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQ0ODY0OCwiZXhwIjoyMDk3MDI0NjQ4fQ.GHIUE1AuZPZLP1A00U8C65aXbyguae6SPb6iK71SjMw";
const DB_URL = "postgresql://postgres:Aa!2026diogo@db.vpzdndtrsrpnslwlsfxe.supabase.co:5432/postgres";

// Use pg directly
import pg from "pg";
const { Client } = pg;

const sql = `
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id TEXT PRIMARY KEY,
  instance_name TEXT NOT NULL,
  remote_jid TEXT NOT NULL,
  from_me BOOLEAN NOT NULL DEFAULT FALSE,
  push_name TEXT,
  message_type TEXT,
  body TEXT,
  timestamp BIGINT NOT NULL,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wamsg_instance_jid ON whatsapp_messages(instance_name, remote_jid);
CREATE INDEX IF NOT EXISTS idx_wamsg_ts ON whatsapp_messages(instance_name, timestamp DESC);

CREATE TABLE IF NOT EXISTS whatsapp_chats (
  id TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  remote_jid TEXT NOT NULL,
  name TEXT,
  push_name TEXT,
  last_message TEXT,
  last_message_time BIGINT DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (instance_name, remote_jid)
);
CREATE INDEX IF NOT EXISTS idx_wachats_time ON whatsapp_chats(instance_name, last_message_time DESC);

CREATE TABLE IF NOT EXISTS whatsapp_settings (
  setting_key TEXT PRIMARY KEY,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const client = new Client({ connectionString: DB_URL });
await client.connect();
await client.query(sql);
console.log("✅ Tabelas whatsapp_messages e whatsapp_chats criadas com sucesso.");
await client.end();
