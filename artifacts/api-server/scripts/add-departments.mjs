import pg from "../../../node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Client } = pg;
const client = new Client({ connectionString: "postgresql://postgres:Aa!2026diogo@db.vpzdndtrsrpnslwlsfxe.supabase.co:5432/postgres" });
await client.connect();
await client.query(`
  CREATE TABLE IF NOT EXISTS whatsapp_departments (
    id SERIAL PRIMARY KEY,
    instance_name TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    UNIQUE(instance_name, name)
  );

  ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS department TEXT;
  ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
  ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS closed_by TEXT;
  ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS subject TEXT;
  ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS marked_unread BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NOW();
`);
await client.query(`
  INSERT INTO whatsapp_departments (instance_name, name, color) VALUES
    ('financeiro','Financeiro','#22c55e'),
    ('financeiro','Suporte','#3b82f6'),
    ('financeiro','Comercial','#f97316'),
    ('financeiro','Geral','#8b5cf6')
  ON CONFLICT DO NOTHING;
`);
console.log("Departments table and columns created.");
await client.end();
