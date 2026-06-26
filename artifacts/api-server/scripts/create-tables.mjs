// Run from lib/db directory: node ../../artifacts/api-server/scripts/create-tables.mjs
import pg from "../../../node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";

const { Client } = pg;
const DB_URL = "postgresql://postgres:Aa!2026diogo@db.vpzdndtrsrpnslwlsfxe.supabase.co:5432/postgres";

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
console.log("Tables created successfully.");
await client.end();
