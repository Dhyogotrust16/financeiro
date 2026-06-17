// Usage:
//   node --env-file=.env ./scripts/backfill-current-month-billings.mjs
// Optional override:
//   BILLING_YEAR=2026 BILLING_MONTH=7
// By default the script uses each client's saved due date month/year.

import pg from "../../../lib/db/node_modules/pg/lib/index.js";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

function parseOverridePeriod() {
  if (process.env.BILLING_YEAR === undefined && process.env.BILLING_MONTH === undefined) {
    return null;
  }

  const year = Number(process.env.BILLING_YEAR);
  const month = Number(process.env.BILLING_MONTH);

  if (!Number.isInteger(year) || year < 2020) {
    throw new Error(`Invalid BILLING_YEAR value: ${process.env.BILLING_YEAR}`);
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid BILLING_MONTH value: ${process.env.BILLING_MONTH}`);
  }

  return { year, month };
}

function buildDueDate(year, month, dueDay) {
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const clampedDay = Math.max(1, Math.min(Number(dueDay), lastDayOfMonth));
  return `${year}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

const overridePeriod = parseOverridePeriod();
const client = new Client({ connectionString });

await client.connect();

let created = 0;
let skipped = 0;

try {
  await client.query("BEGIN");

  const { rows: activeClients } = await client.query(`
    SELECT id, user_id, monthly_fee, due_day, due_date
    FROM clients
    WHERE status = 'ativo' AND monthly_fee > 0
    ORDER BY id
  `);

  for (const row of activeClients) {
    const dueDateIso = new Date(row.due_date).toISOString().slice(0, 10);
    const year = overridePeriod?.year ?? Number(dueDateIso.slice(0, 4));
    const month = overridePeriod?.month ?? Number(dueDateIso.slice(5, 7));
    const dueDate = overridePeriod ? buildDueDate(year, month, row.due_day) : dueDateIso;

    const { rows: existing } = await client.query(
      `
        SELECT 1
        FROM billings
        WHERE user_id = $1
          AND client_id = $2
          AND year = $3
          AND month = $4
        LIMIT 1
      `,
      [row.user_id, row.id, year, month],
    );

    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    const monthlyFee = String(row.monthly_fee);

    const { rows: insertedBilling } = await client.query(
      `
        INSERT INTO billings (
          user_id,
          client_id,
          description,
          category_id,
          month,
          year,
          due_date,
          monthly_fee,
          expenses_total,
          total_amount,
          status
        )
        VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, '0', $7, 'pendente')
        RETURNING id
      `,
      [row.user_id, row.id, `Honorário referente a ${month}/${year}`, month, year, dueDate, monthlyFee],
    );

    const billingId = insertedBilling[0]?.id;
    if (!billingId) {
      throw new Error(`Failed to create billing for client ${row.id}`);
    }

    await client.query(
      `
        INSERT INTO billing_items (billing_id, description, amount, item_type)
        VALUES ($1, $2, $3, 'honorario')
      `,
      [billingId, `Honorário referente a ${month}/${year}`, monthlyFee],
    );

    created += 1;
  }

  await client.query("COMMIT");
  console.log(
    overridePeriod
      ? `Backfill concluído para ${overridePeriod.month}/${overridePeriod.year}: ${created} cobrança(s) criada(s), ${skipped} cliente(s) já tinham cobrança.`
      : `Backfill concluído usando o vencimento de cada cliente: ${created} cobrança(s) criada(s), ${skipped} cliente(s) já tinham cobrança.`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
