import { Router } from "express";
import { db, billingsTable, billingItemsTable, clientsTable, expensesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { clientId, status, startDate, endDate } = req.query as Record<string, string>;

  const conditions = [eq(billingsTable.userId, userId)];
  if (clientId) conditions.push(eq(billingsTable.clientId, Number(clientId)));
  if (status) conditions.push(eq(billingsTable.status, status));
  if (startDate) conditions.push(sql`${billingsTable.dueDate} >= ${startDate}`);
  if (endDate) conditions.push(sql`${billingsTable.dueDate} <= ${endDate}`);

  const rows = await db.select({
    billing: billingsTable,
    clientName: clientsTable.name,
  }).from(billingsTable)
    .leftJoin(clientsTable, eq(billingsTable.clientId, clientsTable.id))
    .where(and(...conditions));

  // Auto-update overdue status
  const now = new Date().toISOString().split("T")[0];
  const result = rows.map(r => {
    let status = r.billing.status;
    if (status === "pendente" && r.billing.dueDate < now) status = "atrasado";
    return formatBilling(r.billing, r.clientName, status);
  });

  return res.json(result);
});

router.post("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { clientId, month, year } = req.body;

  const [client] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, clientId), eq(clientsTable.userId, userId)));
  if (!client) return res.status(404).json({ error: "Cliente não encontrado" });

  // Get passable expenses for this client and month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const expenses = await db.select().from(expensesTable).where(
    and(
      eq(expensesTable.userId, userId),
      eq(expensesTable.clientId, clientId),
      eq(expensesTable.passToClient, true),
      sql`${expensesTable.billedInId} IS NULL`,
      sql`${expensesTable.date} >= ${startDate}`,
      sql`${expensesTable.date} <= ${endDate}`
    )
  );

  const monthlyFee = parseFloat(client.monthlyFee);
  const expensesTotal = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalAmount = monthlyFee + expensesTotal;

  const dueDay = client.dueDay;
  const dueDate = `${year}-${String(month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;

  const [billing] = await db.insert(billingsTable).values({
    userId,
    clientId,
    month,
    year,
    dueDate,
    monthlyFee: String(monthlyFee),
    expensesTotal: String(expensesTotal),
    totalAmount: String(totalAmount),
    status: "pendente",
  }).returning();

  // Insert items
  const items = [
    { billingId: billing.id, description: `Honorário referente a ${month}/${year}`, amount: String(monthlyFee), itemType: "honorario" as const },
    ...expenses.map(e => ({ billingId: billing.id, description: e.description, amount: e.amount, itemType: "despesa" as const, expenseId: e.id })),
  ];
  await db.insert(billingItemsTable).values(items);

  // Mark expenses as billed
  for (const e of expenses) {
    await db.update(expensesTable).set({ billedInId: billing.id }).where(eq(expensesTable.id, e.id));
  }

  return res.status(201).json(formatBilling(billing, client.name, billing.status));
});

router.get("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);

  const rows = await db.select({
    billing: billingsTable,
    clientName: clientsTable.name,
  }).from(billingsTable)
    .leftJoin(clientsTable, eq(billingsTable.clientId, clientsTable.id))
    .where(and(eq(billingsTable.id, id), eq(billingsTable.userId, userId)));

  if (!rows[0]) return res.status(404).json({ error: "Not found" });

  const items = await db.select().from(billingItemsTable).where(eq(billingItemsTable.billingId, id));
  const b = rows[0].billing;
  const now = new Date().toISOString().split("T")[0];
  let status = b.status;
  if (status === "pendente" && b.dueDate < now) status = "atrasado";

  return res.json({
    ...formatBilling(b, rows[0].clientName, status),
    items: items.map(i => ({
      id: i.id,
      billingId: i.billingId,
      description: i.description,
      amount: parseFloat(i.amount),
      itemType: i.itemType,
      expenseId: i.expenseId ?? null,
    })),
  });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const [existing] = await db.select().from(billingsTable).where(and(eq(billingsTable.id, id), eq(billingsTable.userId, userId)));
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status === "pago") return res.status(400).json({ error: "Não é possível excluir cobranças pagas" });

  // Unlink expenses
  await db.update(expensesTable).set({ billedInId: null }).where(eq(expensesTable.billedInId, id));
  await db.delete(billingItemsTable).where(eq(billingItemsTable.billingId, id));
  await db.delete(billingsTable).where(eq(billingsTable.id, id));
  return res.status(204).end();
});

router.post("/:id/mark-paid", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const { paidAt } = req.body;
  const [row] = await db.update(billingsTable).set({ status: "pago", paidAt }).where(and(eq(billingsTable.id, id), eq(billingsTable.userId, userId))).returning();
  if (!row) return res.status(404).json({ error: "Not found" });

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, row.clientId));
  return res.json(formatBilling(row, client?.name ?? null, "pago"));
});

function formatBilling(b: any, clientName: string | null | undefined, status: string) {
  return {
    id: b.id,
    clientId: b.clientId,
    clientName: clientName ?? null,
    month: b.month,
    year: b.year,
    dueDate: b.dueDate,
    monthlyFee: parseFloat(b.monthlyFee),
    expensesTotal: parseFloat(b.expensesTotal),
    totalAmount: parseFloat(b.totalAmount),
    status,
    paidAt: b.paidAt ?? null,
    createdAt: b.createdAt,
  };
}

export default router;
