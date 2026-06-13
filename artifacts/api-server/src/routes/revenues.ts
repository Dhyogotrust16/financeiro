import { Router } from "express";
import { db, revenuesTable, clientsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { clientId, status, startDate, endDate } = req.query as Record<string, string>;

  const conditions = [eq(revenuesTable.userId, userId)];
  if (clientId) conditions.push(eq(revenuesTable.clientId, Number(clientId)));
  if (status) conditions.push(eq(revenuesTable.status, status));
  if (startDate) conditions.push(sql`${revenuesTable.date} >= ${startDate}`);
  if (endDate) conditions.push(sql`${revenuesTable.date} <= ${endDate}`);

  const rows = await db.select({
    revenue: revenuesTable,
    clientName: clientsTable.name,
  }).from(revenuesTable)
    .leftJoin(clientsTable, eq(revenuesTable.clientId, clientsTable.id))
    .where(and(...conditions));

  return res.json(rows.map(r => formatRevenue(r.revenue, r.clientName)));
});

router.post("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { date, clientId, description, amount, paymentMethod, status } = req.body;
  const [row] = await db.insert(revenuesTable).values({
    userId,
    date,
    clientId: clientId ?? null,
    description,
    amount: String(amount),
    paymentMethod: paymentMethod ?? null,
    status: status ?? "pendente",
  }).returning();
  res.status(201).json(formatRevenue(row, null));
});

router.get("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const rows = await db.select({
    revenue: revenuesTable,
    clientName: clientsTable.name,
  }).from(revenuesTable)
    .leftJoin(clientsTable, eq(revenuesTable.clientId, clientsTable.id))
    .where(and(eq(revenuesTable.id, id), eq(revenuesTable.userId, userId)));
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json(formatRevenue(rows[0].revenue, rows[0].clientName));
});

router.patch("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const { date, clientId, description, amount, paymentMethod, status } = req.body;
  const updates: any = {};
  if (date !== undefined) updates.date = date;
  if (clientId !== undefined) updates.clientId = clientId;
  if (description !== undefined) updates.description = description;
  if (amount !== undefined) updates.amount = String(amount);
  if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;
  if (status !== undefined) updates.status = status;
  const [row] = await db.update(revenuesTable).set(updates).where(and(eq(revenuesTable.id, id), eq(revenuesTable.userId, userId))).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(formatRevenue(row, null));
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);
  const [existing] = await db.select().from(revenuesTable).where(and(eq(revenuesTable.id, id), eq(revenuesTable.userId, userId)));
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status === "recebido") return res.status(400).json({ error: "Não é possível excluir receitas já recebidas" });
  await db.delete(revenuesTable).where(eq(revenuesTable.id, id));
  return res.status(204).end();
});

function formatRevenue(r: any, clientName: string | null | undefined) {
  return {
    id: r.id,
    date: r.date,
    clientId: r.clientId ?? null,
    clientName: clientName ?? null,
    description: r.description,
    amount: parseFloat(r.amount),
    paymentMethod: r.paymentMethod ?? null,
    status: r.status,
    createdAt: r.createdAt,
  };
}

export default router;
