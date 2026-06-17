import { Router } from "express";
import { db, clientsTable, expensesTable, billingsTable, billingItemsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

type BillingWriter = Pick<typeof db, "select" | "insert" | "update" | "delete">;

const router = Router();

function buildDueDate(year: number, month: number, dueDay: number): string {
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const clampedDay = Math.max(1, Math.min(dueDay, lastDayOfMonth));
  return `${year}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

function extractDueDay(dueDate: string): number {
  return Number(dueDate.slice(8, 10));
}

function normalizeClientDueDate(dueDate: unknown, dueDay: unknown) {
  const parsedDay = Number(dueDay ?? 10);
  const fallbackDay = Number.isFinite(parsedDay) ? Math.max(1, Math.min(31, parsedDay)) : 10;
  if (typeof dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return {
      dueDate: dueDate.slice(0, 10),
      dueDay: extractDueDay(dueDate),
    };
  }

  const now = new Date();
  return {
    dueDate: buildDueDate(now.getFullYear(), now.getMonth() + 1, fallbackDay),
    dueDay: fallbackDay,
  };
}

async function ensureBillingForClientDueDate(
  database: BillingWriter,
  userId: string,
  client: { id: number; monthlyFee: string | number; dueDay: number; dueDate: string; status: string },
) {
  const fee = parseFloat(String(client.monthlyFee ?? 0));
  if (!(fee > 0) || client.status !== "ativo") return;

  const year = Number(client.dueDate.slice(0, 4));
  const month = Number(client.dueDate.slice(5, 7));

  const [existingBilling] = await database.select().from(billingsTable).where(
    and(
      eq(billingsTable.userId, userId),
      eq(billingsTable.clientId, client.id),
      eq(billingsTable.year, year),
      eq(billingsTable.month, month),
    ),
  );

  if (existingBilling) return;

  const dueDate = buildDueDate(year, month, client.dueDay);
  const [billing] = await database.insert(billingsTable).values({
    userId,
    clientId: client.id,
    description: `Honorário referente a ${month}/${year}`,
    categoryId: null,
    month,
    year,
    dueDate,
    monthlyFee: String(fee),
    expensesTotal: "0",
    totalAmount: String(fee),
    status: "pendente",
  }).returning();

  await database.insert(billingItemsTable).values({
    billingId: billing.id,
    description: `Honorário referente a ${month}/${year}`,
    amount: String(fee),
    itemType: "honorario",
  });
}

router.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { status } = req.query as { status?: string };
  let q = db.select().from(clientsTable).where(eq(clientsTable.userId, userId)).orderBy(desc(clientsTable.createdAt));
  if (status) {
    const rows = await db.select().from(clientsTable).where(and(eq(clientsTable.userId, userId), eq(clientsTable.status, status))).orderBy(desc(clientsTable.createdAt));
    return res.json(rows.map(formatClient));
  }
  const rows = await q;
  return res.json(rows.map(formatClient));
});

router.post("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { name, document, phone, email, address, monthlyFee, dueDate, dueDay, status, notes } = req.body;
  const clientStatus = status ?? "ativo";
  const clientDueDate = normalizeClientDueDate(dueDate, dueDay);

  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(clientsTable).values({
      userId,
      name,
      document,
      phone,
      email,
      address,
      monthlyFee: String(monthlyFee),
      dueDate: clientDueDate.dueDate,
      dueDay: clientDueDate.dueDay,
      status: clientStatus,
      notes,
    }).returning();

    await ensureBillingForClientDueDate(tx, userId, {
      id: created.id,
      monthlyFee: created.monthlyFee,
      dueDay: created.dueDay,
      dueDate: created.dueDate,
      status: created.status,
    });

    return created;
  });

  return res.status(201).json(formatClient(row));
});

router.get("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const [row] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.userId, userId)));
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(formatClient(row));
});

router.patch("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const { name, document, phone, email, address, monthlyFee, dueDate, dueDay, status, notes } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (document !== undefined) updates.document = document;
  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined) updates.email = email;
  if (address !== undefined) updates.address = address;
  if (monthlyFee !== undefined) updates.monthlyFee = String(monthlyFee);
  const normalizedDueDate = normalizeClientDueDate(dueDate, dueDay);
  if (dueDate !== undefined || dueDay !== undefined) {
    updates.dueDate = normalizedDueDate.dueDate;
    updates.dueDay = normalizedDueDate.dueDay;
  }
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(clientsTable).set(updates).where(and(eq(clientsTable.id, id), eq(clientsTable.userId, userId))).returning();
    if (!updated) return null;

    await ensureBillingForClientDueDate(tx, userId, {
      id: updated.id,
      monthlyFee: updated.monthlyFee,
      dueDay: updated.dueDay,
      dueDate: updated.dueDate,
      status: updated.status,
    });

    return updated;
  });

  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(formatClient(row));
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  await db.delete(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.userId, userId)));
  res.status(204).end();
});

router.get("/:id/monthly-close/:year/:month", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const clientId = Number(req.params.id);
  const year = Number(req.params.year);
  const month = Number(req.params.month);

  const [client] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, clientId), eq(clientsTable.userId, userId)));
  if (!client) return res.status(404).json({ error: "Not found" });

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const expenses = await db.select().from(expensesTable).where(
    and(
      eq(expensesTable.userId, userId),
      eq(expensesTable.clientId, clientId),
      eq(expensesTable.passToClient, true),
      sql`${expensesTable.date} >= ${startDate}`,
      sql`${expensesTable.date} <= ${endDate}`
    )
  );

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const monthlyFee = parseFloat(client.monthlyFee);

  return res.json({
    clientId: client.id,
    clientName: client.name,
    month,
    year,
    monthlyFee,
    expenses: expenses.map(formatExpense),
    totalExpenses,
    totalCharge: monthlyFee + totalExpenses,
  });
});

function formatClient(c: any) {
  return {
    id: c.id,
    name: c.name,
    document: c.document ?? null,
    phone: c.phone ?? null,
    email: c.email ?? null,
    address: c.address ?? null,
    monthlyFee: parseFloat(c.monthlyFee),
    dueDate: c.dueDate,
    dueDay: c.dueDay,
    status: c.status,
    notes: c.notes ?? null,
    createdAt: c.createdAt,
  };
}

function formatExpense(e: any) {
  return {
    id: e.id,
    date: e.date,
    description: e.description,
    amount: parseFloat(e.amount),
    categoryId: e.categoryId ?? null,
    categoryName: null,
    clientId: e.clientId ?? null,
    clientName: null,
    passToClient: e.passToClient,
    billedInId: e.billedInId ?? null,
    createdAt: e.createdAt,
  };
}

export default router;
