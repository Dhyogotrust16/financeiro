import { Router } from "express";
import { db, billingsTable, billingItemsTable, clientsTable, categoriesTable, expensesTable, revenuesTable } from "@workspace/db";
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
    categoryName: categoriesTable.name,
  }).from(billingsTable)
    .leftJoin(clientsTable, eq(billingsTable.clientId, clientsTable.id))
    .leftJoin(categoriesTable, eq(billingsTable.categoryId, categoriesTable.id))
    .where(and(...conditions));

  // Auto-update overdue status
  const now = new Date().toISOString().split("T")[0];
  const result = rows.map(r => {
    let status = r.billing.status;
    if (status === "pendente" && r.billing.dueDate < now) status = "atrasado";
    return formatBilling(r.billing, r.clientName, status, r.categoryName);
  });

  return res.json(result);
});

router.post("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { clientId, description, categoryId, dueDate, amount } = req.body;
  const parsedClientId = clientId === undefined || clientId === null || clientId === "" ? null : Number(clientId);
  const hasClient = Number.isFinite(parsedClientId) && Number(parsedClientId) > 0;
  const normalizedDescription = typeof description === "string" ? description.trim() : "";

  if (typeof dueDate !== "string" || !dueDate) {
    return res.status(400).json({ error: "Data de vencimento obrigatória" });
  }

  const [yearPart, monthPart] = dueDate.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return res.status(400).json({ error: "Data de vencimento inválida" });
  }

  const [category] = categoryId === undefined || categoryId === null || categoryId === ""
    ? []
    : await db.select().from(categoriesTable).where(and(eq(categoriesTable.id, Number(categoryId)), eq(categoriesTable.userId, userId), eq(categoriesTable.type, "receita")));
  if (categoryId !== undefined && categoryId !== null && categoryId !== "" && !category) {
    return res.status(400).json({ error: "Categoria incompatível com cobrança" });
  }

  if (hasClient) {
    const clientIdNumber = Number(parsedClientId);
    const [client] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, clientIdNumber), eq(clientsTable.userId, userId)));
    if (!client) return res.status(404).json({ error: "Cliente não encontrado" });

    // Get passable expenses for this client and month
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const expenses = await db.select().from(expensesTable).where(
      and(
        eq(expensesTable.userId, userId),
        eq(expensesTable.clientId, clientIdNumber),
        eq(expensesTable.passToClient, true),
        sql`${expensesTable.billedInId} IS NULL`,
        sql`${expensesTable.date} >= ${startDate}`,
        sql`${expensesTable.date} <= ${endDate}`
      )
    );

    const monthlyFee = Number.isFinite(Number(amount)) ? Number(amount) : parseFloat(client.monthlyFee);
    const expensesTotal = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
    const totalAmount = monthlyFee + expensesTotal;
    const billingDescription = normalizedDescription || `Honorário referente a ${month}/${year}`;

    const [billing] = await db.insert(billingsTable).values({
      userId,
      clientId: clientIdNumber,
      description: billingDescription,
      categoryId: category?.id ?? null,
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
      { billingId: billing.id, description: billingDescription, amount: String(monthlyFee), itemType: "honorario" as const },
      ...expenses.map((e) => ({ billingId: billing.id, description: e.description, amount: e.amount, itemType: "despesa" as const, expenseId: e.id })),
    ];
    await db.insert(billingItemsTable).values(items);

    // Mark expenses as billed
    for (const e of expenses) {
      await db.update(expensesTable).set({ billedInId: billing.id }).where(eq(expensesTable.id, e.id));
    }

    return res.status(201).json(formatBilling(billing, client.name, billing.status, category?.name ?? null));
  }

  if (!normalizedDescription) {
    return res.status(400).json({ error: "Descrição obrigatória" });
  }

  const manualAmount = Number(amount);
  if (!Number.isFinite(manualAmount) || manualAmount <= 0) {
    return res.status(400).json({ error: "Valor inválido" });
  }

  const [billing] = await db.insert(billingsTable).values({
    userId,
    clientId: null,
    description: normalizedDescription,
    categoryId: category?.id ?? null,
    month,
    year,
    dueDate,
    monthlyFee: String(manualAmount),
    expensesTotal: "0",
    totalAmount: String(manualAmount),
    status: "pendente",
  }).returning();

  await db.insert(billingItemsTable).values({
    billingId: billing.id,
    description: normalizedDescription,
    amount: String(manualAmount),
    itemType: "manual",
  });

  return res.status(201).json(formatBilling(billing, null, billing.status, category?.name ?? null));
});

router.get("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);

  const rows = await db.select({
    billing: billingsTable,
    clientName: clientsTable.name,
    categoryName: categoriesTable.name,
  }).from(billingsTable)
    .leftJoin(clientsTable, eq(billingsTable.clientId, clientsTable.id))
    .leftJoin(categoriesTable, eq(billingsTable.categoryId, categoriesTable.id))
    .where(and(eq(billingsTable.id, id), eq(billingsTable.userId, userId)));

  if (!rows[0]) return res.status(404).json({ error: "Not found" });

  const items = await db.select().from(billingItemsTable).where(eq(billingItemsTable.billingId, id));
  const b = rows[0].billing;
  const now = new Date().toISOString().split("T")[0];
  let status = b.status;
  if (status === "pendente" && b.dueDate < now) status = "atrasado";

  return res.json({
    ...formatBilling(b, rows[0].clientName, status, rows[0].categoryName),
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

  const [client] = row.clientId
    ? await db.select().from(clientsTable).where(eq(clientsTable.id, row.clientId))
    : [];
  const [category] = row.categoryId
    ? await db.select({ name: categoriesTable.name }).from(categoriesTable).where(and(
        eq(categoriesTable.id, row.categoryId),
        eq(categoriesTable.type, "receita")
      ))
    : [];

  const monthNames = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const monthLabel = monthNames[(row.month ?? 1) - 1] ?? String(row.month);
  const baseDescription = row.description?.trim() || `Cobrança ${monthLabel}/${row.year}`;
  const description = `Recebimento ${baseDescription}${client?.name ? ` – ${client.name}` : ""}`;
  const receivedDate = paidAt ?? new Date().toISOString().slice(0, 10);

  await db.insert(revenuesTable).values({
    userId,
    clientId: row.clientId ?? null,
    description,
    amount: row.totalAmount,
    date: receivedDate,
    paymentMethod: "outros",
    status: "recebido",
  });

  return res.json(formatBilling(row, client?.name ?? null, "pago", category?.name ?? null));
});

function formatBilling(b: any, clientName: string | null | undefined, status: string, categoryName: string | null | undefined) {
  const description = typeof b.description === "string" && b.description.trim()
    ? b.description.trim()
    : clientName
    ? `Honorário referente a ${b.month}/${b.year}`
    : `Cobrança ${b.month}/${b.year}`;

  return {
    id: b.id,
    clientId: b.clientId ?? null,
    clientName: clientName ?? null,
    description,
    categoryId: b.categoryId ?? null,
    categoryName: categoryName ?? null,
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
