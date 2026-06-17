import { Router } from "express";
import { db, categoriesTable } from "@workspace/db";
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

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  await db.delete(categoriesTable).where(and(eq(categoriesTable.id, id), eq(categoriesTable.userId, userId)));
  res.status(204).end();
});

export default router;
