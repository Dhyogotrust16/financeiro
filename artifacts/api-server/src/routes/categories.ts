import { Router } from "express";
import { db, categoriesTable, payablesTable, billingsTable, expensesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const rows = await db.select().from(categoriesTable).where(eq(categoriesTable.userId, userId));
  res.json(rows.map((r) => ({ id: r.id, name: r.name, type: r.type ?? "despesa" })));
});

router.post("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { name, type } = req.body;
  const normalizedType = type === "receita" ? "receita" : "despesa";
  const [row] = await db.insert(categoriesTable).values({ userId, name, type: normalizedType }).returning();
  res.status(201).json({ id: row.id, name: row.name, type: row.type ?? normalizedType });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const { name, type } = req.body;

  const [category] = await db.select().from(categoriesTable).where(and(eq(categoriesTable.id, id), eq(categoriesTable.userId, userId)));

  if (!category) {
    return res.status(404).json({ error: "Categoria não encontrada" });
  }

  const normalizedName = typeof name === "string" ? name.trim() : category.name;
  const normalizedType = type === "receita" ? "receita" : type === "despesa" ? "despesa" : category.type;

  if (normalizedType !== category.type) {
    const [existingExpense] = await db.select({ id: expensesTable.id })
      .from(expensesTable)
      .where(and(eq(expensesTable.categoryId, id), eq(expensesTable.userId, userId)))
      .limit(1);

    const [existingPayable] = await db.select({ id: payablesTable.id })
      .from(payablesTable)
      .where(and(eq(payablesTable.categoryId, id), eq(payablesTable.userId, userId)))
      .limit(1);

    const [existingBilling] = await db.select({ id: billingsTable.id })
      .from(billingsTable)
      .where(and(eq(billingsTable.categoryId, id), eq(billingsTable.userId, userId)))
      .limit(1);

    if (existingExpense || existingPayable || existingBilling) {
      return res.status(409).json({ error: "Não é possível alterar o tipo de categoria enquanto ela estiver vinculada a registros" });
    }
  }

  const [updated] = await db
    .update(categoriesTable)
    .set({ name: normalizedName, type: normalizedType })
    .where(and(eq(categoriesTable.id, id), eq(categoriesTable.userId, userId)))
    .returning();

  return res.json({ id: updated.id, name: updated.name, type: updated.type ?? normalizedType });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);

  const [existingExpense] = await db.select({ id: expensesTable.id })
    .from(expensesTable)
    .where(and(eq(expensesTable.categoryId, id), eq(expensesTable.userId, userId)))
    .limit(1);

  const [existingPayable] = await db.select({ id: payablesTable.id })
    .from(payablesTable)
    .where(and(eq(payablesTable.categoryId, id), eq(payablesTable.userId, userId)))
    .limit(1);

  const [existingBilling] = await db.select({ id: billingsTable.id })
    .from(billingsTable)
    .where(and(eq(billingsTable.categoryId, id), eq(billingsTable.userId, userId)))
    .limit(1);

  if (existingExpense || existingPayable || existingBilling) {
    return res.status(409).json({ error: "Categoria vinculada a despesas, contas a pagar ou contas a receber" });
  }

  await db.delete(categoriesTable).where(and(eq(categoriesTable.id, id), eq(categoriesTable.userId, userId)));
  return res.status(204).end();
});

export default router;
