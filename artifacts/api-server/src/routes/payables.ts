import { Router } from "express";
import { db, payablesTable, categoriesTable, expensesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { status, startDate, endDate, categoryId } = req.query as Record<string, string>;

  const conditions = [eq(payablesTable.userId, userId)];
  if (status) conditions.push(eq(payablesTable.status, status));
  if (categoryId) conditions.push(eq(payablesTable.categoryId, Number(categoryId)));
  if (startDate) conditions.push(sql`${payablesTable.dueDate} >= ${startDate}`);
  if (endDate) conditions.push(sql`${payablesTable.dueDate} <= ${endDate}`);

  const rows = await db.select({
    payable: payablesTable,
    categoryName: categoriesTable.name,
  }).from(payablesTable)
    .leftJoin(categoriesTable, eq(payablesTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(payablesTable.dueDate);

  return res.json(rows.map(r => formatPayable(r.payable, r.categoryName)));
});

router.post("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { description, amount, dueDate, categoryId } = req.body;
  const [row] = await db.insert(payablesTable).values({
    userId,
    description,
    amount: String(amount),
    dueDate,
    categoryId: categoryId ?? null,
    status: "pendente",
  }).returning();
  return res.status(201).json(formatPayable(row, null));
});

router.patch("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const { description, amount, dueDate, categoryId } = req.body;
  const updates: any = {};
  if (description !== undefined) updates.description = description;
  if (amount !== undefined) updates.amount = String(amount);
  if (dueDate !== undefined) updates.dueDate = dueDate;
  if (categoryId !== undefined) updates.categoryId = categoryId;
  const [row] = await db.update(payablesTable)
    .set(updates)
    .where(and(eq(payablesTable.id, id), eq(payablesTable.userId, userId), eq(payablesTable.status, "pendente")))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found or already paid" });
  return res.json(formatPayable(row, null));
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const [existing] = await db.select().from(payablesTable)
    .where(and(eq(payablesTable.id, id), eq(payablesTable.userId, userId)));
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status === "pago") return res.status(400).json({ error: "Não é possível excluir uma conta já paga" });
  await db.delete(payablesTable).where(eq(payablesTable.id, id));
  return res.status(204).end();
});

// POST /payables/:id/pay — marks as paid and creates an expense
router.post("/:id/pay", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const { paidAt } = req.body;

  const [payable] = await db.select().from(payablesTable)
    .where(and(eq(payablesTable.id, id), eq(payablesTable.userId, userId)));
  if (!payable) return res.status(404).json({ error: "Not found" });
  if (payable.status === "pago") return res.status(400).json({ error: "Conta já paga" });

  const payDate = paidAt ?? new Date().toISOString().split("T")[0];

  const [expense] = await db.insert(expensesTable).values({
    userId,
    description: payable.description,
    amount: payable.amount,
    date: payDate,
    categoryId: payable.categoryId ?? null,
    passToClient: false,
  }).returning();

  const [updated] = await db.update(payablesTable)
    .set({ status: "pago", paidAt: payDate, expenseId: expense.id })
    .where(eq(payablesTable.id, id))
    .returning();

  return res.json(formatPayable(updated, null));
});

function formatPayable(p: any, categoryName: string | null | undefined) {
  return {
    id: p.id,
    description: p.description,
    amount: parseFloat(p.amount),
    dueDate: p.dueDate,
    categoryId: p.categoryId ?? null,
    categoryName: categoryName ?? null,
    status: p.status,
    paidAt: p.paidAt ?? null,
    expenseId: p.expenseId ?? null,
    createdAt: p.createdAt,
  };
}

export default router;
