import pg from "../../../node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Client } = pg;
const client = new Client({ connectionString: "postgresql://postgres:Aa!2026diogo@db.vpzdndtrsrpnslwlsfxe.supabase.co:5432/postgres" });
await client.connect();
await client.query(`
  -- Comentários internos (não enviados ao cliente)
  CREATE TABLE IF NOT EXISTS whatsapp_internal_comments (
    id SERIAL PRIMARY KEY,
    instance_name TEXT NOT NULL,
    remote_jid TEXT NOT NULL,
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_wic_jid ON whatsapp_internal_comments(instance_name, remote_jid);

  -- Mensagens agendadas
  CREATE TABLE IF NOT EXISTS whatsapp_scheduled (
    id SERIAL PRIMARY KEY,
    instance_name TEXT NOT NULL,
    remote_jid TEXT NOT NULL,
    body TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_wsched ON whatsapp_scheduled(instance_name, scheduled_at, sent);

  -- Campos personalizados por contato
  CREATE TABLE IF NOT EXISTS whatsapp_contact_fields (
    instance_name TEXT NOT NULL,
    remote_jid TEXT NOT NULL,
    field_key TEXT NOT NULL,
    field_value TEXT,
    PRIMARY KEY (instance_name, remote_jid, field_key)
  );
`);
console.log("Advanced features tables created.");
await client.end();
