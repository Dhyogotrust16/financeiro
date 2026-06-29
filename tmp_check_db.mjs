import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
});

try {
  const version = await sql`select version() as v`;
  console.log('version', version);

  const exists = await sql`select to_regclass('public.partners') as relation`;
  console.log('relation', exists);

  const cols = await sql`
    select column_name, data_type
    from information_schema.columns
    where table_name='partners'
    order by ordinal_position
  `;
  console.log('columns', cols);

  const sample = await sql`
    select * from partners limit 1
  `;
  console.log('sample', sample);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await sql.end();
}
