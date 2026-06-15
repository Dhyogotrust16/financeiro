import pg from "../../../node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Client } = pg;
const client = new Client({ connectionString: "postgresql://postgres:Aa!2026diogo@db.vpzdndtrsrpnslwlsfxe.supabase.co:5432/postgres" });
await client.connect();
await client.query(`
  ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
  ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS assigned_to TEXT;
  ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
  ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS internal_notes TEXT;
  ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS protocol TEXT;

  CREATE SEQUENCE IF NOT EXISTS whatsapp_protocol_seq START 1000;

  CREATE TABLE IF NOT EXISTS whatsapp_tags (
    id SERIAL PRIMARY KEY,
    instance_name TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    UNIQUE(instance_name, name)
  );
`);
// Seed default tags
await client.query(`
  INSERT INTO whatsapp_tags (instance_name, name, color) VALUES
    ('financeiro','cobrança','#ef4444'),
    ('financeiro','suporte','#3b82f6'),
    ('financeiro','urgente','#f97316'),
    ('financeiro','cliente','#22c55e'),
    ('financeiro','novo lead','#8b5cf6')
  ON CONFLICT DO NOTHING;
`);
// Set protocol for existing chats
await client.query(`
  UPDATE whatsapp_chats SET protocol = LPAD(nextval('whatsapp_protocol_seq')::TEXT, 6, '0') WHERE protocol IS NULL;
`);
console.log("SAC columns and tags created.");
await client.end();
