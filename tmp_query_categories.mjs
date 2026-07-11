import postgres from 'postgres';

const conn = process.env.SUPABASE_POOLER_URL ?? process.env.DATABASE_URL;
if (!conn) {
  console.error('no db');
  process.exit(1);
}

const sql = postgres(conn, { ssl: 'require' });
const rows = await sql`
  select
    c.id,
    c.name,
    c.user_id,
    (select count(*) from expenses e where e.category_id = c.id and e.user_id = c.user_id) as expense_count,
    (select count(*) from payables p where p.category_id = c.id and p.user_id = c.user_id) as payable_count,
    (select count(*) from billings b where b.category_id = c.id and b.user_id = c.user_id) as billing_count
  from categories c
  where
    (select count(*) from expenses e where e.category_id = c.id and e.user_id = c.user_id) +
    (select count(*) from payables p where p.category_id = c.id and p.user_id = c.user_id) +
    (select count(*) from billings b where b.category_id = c.id and b.user_id = c.user_id) > 0
  order by c.id
  limit 20;
`;

console.log(JSON.stringify(rows, null, 2));
await sql.end();
