import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();
const sqlQuery = sql as any;

interface PartnerRow {
  id: string;
  name: string;
  email?: string | null;
  percentage: string | number;
  responsavel_legal?: boolean | null;
}

interface PartnerInput {
  id?: unknown;
  name?: unknown;
  email?: unknown;
  percentage?: unknown;
  responsavelLegal?: unknown;
}

let ensurePartnersTablePromise: Promise<void> | null = null;

async function ensurePartnersTable() {
  if (!ensurePartnersTablePromise) {
    ensurePartnersTablePromise = db
      .execute(sqlQuery`
        CREATE TABLE IF NOT EXISTS partners (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          email TEXT,
          percentage NUMERIC(5, 2) NOT NULL,
          responsavel_legal BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() =>
        db.execute(sqlQuery`
          ALTER TABLE partners ADD COLUMN IF NOT EXISTS responsavel_legal BOOLEAN NOT NULL DEFAULT FALSE
        `),
      )
      .then(() =>
        db.execute(sqlQuery`
          CREATE INDEX IF NOT EXISTS idx_partners_user_id ON partners(user_id)
        `),
      )
      .then(() => undefined)
      .catch((err) => {
        ensurePartnersTablePromise = null;
        throw err;
      });
  }

  return ensurePartnersTablePromise;
}

function serializePartner(row: PartnerRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    percentage: Number(row.percentage),
    responsavelLegal: row.responsavel_legal === true,
  };
}

function normalizePartner(input: PartnerInput) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const rawPercentage =
    typeof input.percentage === "string"
      ? Number(input.percentage.replace(",", "."))
      : Number(input.percentage);
  const percentage = Number.isFinite(rawPercentage) ? Math.max(0, Math.min(rawPercentage, 100)) : 0;
  const id = typeof input.id === "string" && input.id.trim() ? input.id.trim() : randomUUID();
  const responsavelLegal =
    input.responsavelLegal === true || input.responsavelLegal === "true";

  return { id, name, email, percentage, responsavelLegal };
}

router.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  await ensurePartnersTable();

  const rows = (await db.execute(sqlQuery`
    SELECT id, name, email, percentage, responsavel_legal
    FROM partners
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `)) as unknown as PartnerRow[];

  res.json(rows.map(serializePartner));
});

router.put("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const body = req.body as { partners?: PartnerInput[] };
  const partners = Array.isArray(body.partners) ? body.partners.map(normalizePartner) : [];
  const legalCount = partners.filter((p) => p.responsavelLegal === true).length;
  if (legalCount > 1) {
    res.status(400).json({ error: "Apenas um sócio pode ser marcado como responsável legal." });
    return;
  }
  const totalPercentage = partners.reduce((sum, partner) => sum + partner.percentage, 0);

  if (partners.some((partner) => !partner.name)) {
    res.status(400).json({ error: "Todos os sócios precisam ter nome." });
    return;
  }

  if (partners.some((partner) => partner.percentage <= 0)) {
    res.status(400).json({ error: "Todos os sócios precisam ter percentual maior que zero." });
    return;
  }

  if (totalPercentage > 100.0001) {
    res.status(400).json({ error: "A soma dos percentuais não pode ultrapassar 100%." });
    return;
  }

  await ensurePartnersTable();

  await db.transaction(async (tx) => {
    await tx.execute(sqlQuery`DELETE FROM partners WHERE user_id = ${userId}`);

    for (const partner of partners) {
      await tx.execute(sqlQuery`
        INSERT INTO partners (id, user_id, name, email, percentage, responsavel_legal, created_at, updated_at)
        VALUES (${partner.id}, ${userId}, ${partner.name}, ${partner.email}, ${partner.percentage}, ${partner.responsavelLegal}, NOW(), NOW())
      `);
    }
  });

  const rows = (await db.execute(sqlQuery`
    SELECT id, name, email, percentage, responsavel_legal
    FROM partners
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `)) as unknown as PartnerRow[];

  res.json(rows.map(serializePartner));
});

export default router;
