import pg from "../../../node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Client } = pg;
const client = new Client({ connectionString: "postgresql://postgres:Aa!2026diogo@db.vpzdndtrsrpnslwlsfxe.supabase.co:5432/postgres" });
await client.connect();
await client.query(`ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS profile_pic TEXT`);
console.log("Column profile_pic added.");
await client.end();
