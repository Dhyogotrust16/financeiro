import { Router } from "express";
import { db, expensesTable, clientsTable, categoriesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { clientId, passToClient, startDate, endDate } = req.query as Record<string, string>;

  const conditions = [eq(expensesTable.userId, userId)];
  if (clientId) conditions.push(eq(expensesTable.clientId, Number(clientId)));
  if (passToClient !== undefined) conditions.push(eq(expensesTable.passToClient, passToClient === "true"));
  if (startDate) conditions.push(sql`${expensesTable.date} >= ${startDate}`);
  if (endDate) conditions.push(sql`${expensesTable.date} <= ${endDate}`);

  const rows = await db.select({
    expense: expensesTable,
    clientName: clientsTable.name,
    categoryName: categoriesTable.name,
  }).from(expensesTable)
    .leftJoin(clientsTable, eq(expensesTable.clientId, clientsTable.id))
    .leftJoin(categoriesTable, eq(expensesTable.categoryId, categoriesTable.id))
    .where(and(...conditions));

  return res.json(rows.map(r => formatExpense(r.expense, r.clientName, r.categoryName)));
});

router.post("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { date, description, amount, categoryId, clientId, passToClient } = req.body;
  const [category] = categoryId === undefined || categoryId === null || categoryId === ""
    ? []
    : await db.select().from(categoriesTable).where(and(
        eq(categoriesTable.id, Number(categoryId)),
        eq(categoriesTable.userId, userId),
        eq(categoriesTable.type, "despesa")
      ));
  if (categoryId !== undefined && categoryId !== null && categoryId !== "" && !category) {
    return res.status(400).json({ error: "Categoria incompatível com despesa" });
  }
  const [row] = await db.insert(expensesTable).values({
    userId,
    date,
    description,
    amount: String(amount),
    categoryId: category?.id ?? null,
    clientId: clientId ?? null,
    passToClient: passToClient ?? false,
  }).returning();
  return res.status(201).json(formatExpense(row, null, null));
});

router.get("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const rows = await db.select({
    expense: expensesTable,
    clientName: clientsTable.name,
    categoryName: categoriesTable.name,
  }).from(expensesTable)
    .leftJoin(clientsTable, eq(expensesTable.clientId, clientsTable.id))
    .leftJoin(categoriesTable, eq(expensesTable.categoryId, categoriesTable.id))
    .where(and(eq(expensesTable.id, id), eq(expensesTable.userId, userId)));
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json(formatExpense(rows[0].expense, rows[0].clientName, rows[0].categoryName));
});

router.patch("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const { date, description, amount, categoryId, clientId, passToClient } = req.body;
  const [category] = categoryId === undefined || categoryId === null || categoryId === ""
    ? []
    : await db.select().from(categoriesTable).where(and(
        eq(categoriesTable.id, Number(categoryId)),
        eq(categoriesTable.userId, userId),
        eq(categoriesTable.type, "despesa")
      ));
  if (categoryId !== undefined && categoryId !== null && categoryId !== "" && !category) {
    return res.status(400).json({ error: "Categoria incompatível com despesa" });
  }
  const updates: any = {};
  if (date !== undefined) updates.date = date;
  if (description !== undefined) updates.description = description;
  if (amount !== undefined) updates.amount = String(amount);
  if (categoryId !== undefined) updates.categoryId = category?.id ?? null;
  if (clientId !== undefined) updates.clientId = clientId;
  if (passToClient !== undefined) updates.passToClient = passToClient;
  const [row] = await db.update(expensesTable).set(updates).where(and(eq(expensesTable.id, id), eq(expensesTable.userId, userId))).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  const [clientRow] = row.clientId
    ? await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, row.clientId))
    : [];
  const [categoryRow] = row.categoryId
    ? await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, row.categoryId))
    : [];
  return res.json(formatExpense(row, clientRow?.name ?? null, categoryRow?.name ?? null));
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const [existing] = await db.select().from(expensesTable).where(and(eq(expensesTable.id, id), eq(expensesTable.userId, userId)));
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.billedInId) return res.status(400).json({ error: "Não é possível excluir despesas já cobradas" });
  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  return res.status(204).end();
});

function formatExpense(e: any, clientName: string | null | undefined, categoryName: string | null | undefined) {
  return {
    id: e.id,
    date: e.date,
    description: e.description,
    amount: parseFloat(e.amount),
    categoryId: e.categoryId ?? null,
    categoryName: categoryName ?? null,
    clientId: e.clientId ?? null,
    clientName: clientName ?? null,
    passToClient: e.passToClient,
    billedInId: e.billedInId ?? null,
    createdAt: e.createdAt,
  };
}

export default router;
