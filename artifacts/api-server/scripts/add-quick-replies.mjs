import pg from "../../../node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Client } = pg;
const client = new Client({ connectionString: "postgresql://postgres:Aa!2026diogo@db.vpzdndtrsrpnslwlsfxe.supabase.co:5432/postgres" });
await client.connect();
await client.query(`
  CREATE TABLE IF NOT EXISTS whatsapp_quick_replies (
    id SERIAL PRIMARY KEY,
    instance_name TEXT NOT NULL,
    shortcut TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(instance_name, shortcut)
  );
`);
await client.query(`
  INSERT INTO whatsapp_quick_replies (instance_name, shortcut, title, body) VALUES
    ('financeiro', '/ola',      'Saudação',          'Olá! Como posso te ajudar hoje? 😊'),
    ('financeiro', '/boleto',   'Boleto pendente',   'Seu boleto está disponível. Posso te enviar agora. Qual a melhor forma de pagamento?'),
    ('financeiro', '/cobranca', 'Cobrança em aberto','Identificamos um valor em aberto no seu cadastro. Podemos conversar sobre isso?'),
    ('financeiro', '/obrigado', 'Encerramento',      'Obrigado pelo contato! Qualquer dúvida, estamos à disposição. Tenha um ótimo dia! 👋')
  ON CONFLICT DO NOTHING;
`);
console.log("Quick replies table created.");
await client.end();
