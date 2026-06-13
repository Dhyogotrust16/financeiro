import { Router } from "express";
import { db, clientsTable, expensesTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

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
  const { name, document, phone, email, address, monthlyFee, dueDay, status, notes } = req.body;
  const [row] = await db.insert(clientsTable).values({
    userId,
    name,
    document,
    phone,
    email,
    address,
    monthlyFee: String(monthlyFee),
    dueDay: dueDay ?? 10,
    status: status ?? "ativo",
    notes,
  }).returning();
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
  const { name, document, phone, email, address, monthlyFee, dueDay, status, notes } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (document !== undefined) updates.document = document;
  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined) updates.email = email;
  if (address !== undefined) updates.address = address;
  if (monthlyFee !== undefined) updates.monthlyFee = String(monthlyFee);
  if (dueDay !== undefined) updates.dueDay = dueDay;
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  const [row] = await db.update(clientsTable).set(updates).where(and(eq(clientsTable.id, id), eq(clientsTable.userId, userId))).returning();
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
  const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

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
