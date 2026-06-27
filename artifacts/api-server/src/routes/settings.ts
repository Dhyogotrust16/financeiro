import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();
const sqlQuery = sql as any;

interface UserSettingsRow {
  phone?: string | null;
  role?: string | null;
  company?: string | null;
  bio?: string | null;
  logo_data_url?: string | null;
}

let ensureSettingsTablePromise: Promise<void> | null = null;

async function ensureSettingsTable() {
  if (!ensureSettingsTablePromise) {
    ensureSettingsTablePromise = db
      .execute(sqlQuery`
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id TEXT PRIMARY KEY,
          phone TEXT,
          role TEXT,
          company TEXT,
          bio TEXT,
          logo_data_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => undefined)
      .catch((err) => {
        ensureSettingsTablePromise = null;
        throw err;
      });
  }

  return ensureSettingsTablePromise;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLogo(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  return value.startsWith("data:image/") ? value : null;
}

function serializeSettings(row?: UserSettingsRow | null) {
  return {
    phone: row?.phone ?? "",
    role: row?.role ?? "",
    company: row?.company ?? "",
    bio: row?.bio ?? "",
    logoDataUrl: row?.logo_data_url ?? null,
  };
}

router.get("/profile", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  await ensureSettingsTable();

  const rows = (await db.execute(sqlQuery`
    SELECT phone, role, company, bio, logo_data_url
    FROM user_settings
    WHERE user_id = ${userId}
    LIMIT 1
  `)) as UserSettingsRow[];

  res.json(serializeSettings(rows[0]));
});

router.put("/profile", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const body = req.body as Record<string, unknown>;
  const logoDataUrl = normalizeLogo(body.logoDataUrl);

  await ensureSettingsTable();

  const rows = (await db.execute(sqlQuery`
    INSERT INTO user_settings (user_id, phone, role, company, bio, logo_data_url, created_at, updated_at)
    VALUES (
      ${userId},
      ${normalizeText(body.phone)},
      ${normalizeText(body.role)},
      ${normalizeText(body.company)},
      ${normalizeText(body.bio)},
      ${logoDataUrl},
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        company = EXCLUDED.company,
        bio = EXCLUDED.bio,
        logo_data_url = EXCLUDED.logo_data_url,
        updated_at = NOW()
    RETURNING phone, role, company, bio, logo_data_url
  `)) as UserSettingsRow[];

  res.json(serializeSettings(rows[0]));
});

export default router;
