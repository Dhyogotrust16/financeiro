import { Router } from "express";
import { db, revenuesTable, expensesTable, clientsTable, billingsTable, payablesTable } from "@workspace/db";
import { eq, and, sql, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/summary/:year/:month", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const year = Number(req.params.year);
  const month = Number(req.params.month);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Total revenues for the month
  const revenueRows = await db.select({ amount: revenuesTable.amount }).from(revenuesTable)
    .where(and(eq(revenuesTable.userId, userId), eq(revenuesTable.status, "recebido"), sql`${revenuesTable.date} >= ${startDate}`, sql`${revenuesTable.date} <= ${endDate}`));
  const totalRevenue = revenueRows.reduce((s, r) => s + parseFloat(r.amount), 0);

  // Total expenses for the month
  const expenseRows = await db.select({ amount: expensesTable.amount }).from(expensesTable)
    .where(and(eq(expensesTable.userId, userId), sql`${expensesTable.date} >= ${startDate}`, sql`${expensesTable.date} <= ${endDate}`));
  const totalExpenses = expenseRows.reduce((s, e) => s + parseFloat(e.amount), 0);

  // Active clients
  const activeClients = await db.select({ count: count() }).from(clientsTable)
    .where(and(eq(clientsTable.userId, userId), eq(clientsTable.status, "ativo")));

  // Pending receivables (all time pending billings)
  const pendingBillings = await db.select({ amount: billingsTable.totalAmount }).from(billingsTable)
    .where(and(eq(billingsTable.userId, userId), eq(billingsTable.status, "pendente")));
  const pendingReceivables = pendingBillings.reduce((s, b) => s + parseFloat(b.amount), 0);

  // Pending payables (unpaid entries in payables table)
  const payableRows = await db.select({ amount: payablesTable.amount }).from(payablesTable)
    .where(and(eq(payablesTable.userId, userId), eq(payablesTable.status, "pendente")));
  const pendingPayables = payableRows.reduce((s, p) => s + parseFloat(p.amount), 0);

  // Overdue billings
  const now = new Date().toISOString().split("T")[0];
  const overdueRows = await db.select({ count: count() }).from(billingsTable)
    .where(and(eq(billingsTable.userId, userId), eq(billingsTable.status, "pendente"), sql`${billingsTable.dueDate} < ${now}`));
  const overdueCount = Number(overdueRows[0]?.count ?? 0);

  res.json({
    totalRevenue,
    totalExpenses,
    balance: totalRevenue - totalExpenses,
    activeClients: Number(activeClients[0]?.count ?? 0),
    pendingReceivables,
    pendingPayables,
    overdueCount,
  });
});

router.get("/cashflow", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const months = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}`;

    const revenueRows = await db.select({ amount: revenuesTable.amount }).from(revenuesTable)
      .where(and(eq(revenuesTable.userId, userId), eq(revenuesTable.status, "recebido"), sql`${revenuesTable.date} >= ${startDate}`, sql`${revenuesTable.date} <= ${endDate}`));
    const revenue = revenueRows.reduce((s, r) => s + parseFloat(r.amount), 0);

    const expenseRows = await db.select({ amount: expensesTable.amount }).from(expensesTable)
      .where(and(eq(expensesTable.userId, userId), sql`${expensesTable.date} >= ${startDate}`, sql`${expensesTable.date} <= ${endDate}`));
    const expenses = expenseRows.reduce((s, e) => s + parseFloat(e.amount), 0);

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    months.push({
      month,
      year,
      label: `${monthNames[month - 1]}/${String(year).slice(2)}`,
      revenue,
      expenses,
      balance: revenue - expenses,
    });
  }

  res.json(months);
});

router.get("/client-profitability", requireAuth, async (req, res) => {
  const userId = (req as any).userId;

  const clients = await db.select().from(clientsTable).where(eq(clientsTable.userId, userId));
  const result = [];

  for (const client of clients) {
    const allBillings = await db.select().from(billingsTable)
      .where(and(eq(billingsTable.userId, userId), eq(billingsTable.clientId, client.id)));
    const totalBilled = allBillings.reduce((s, b) => s + parseFloat(b.totalAmount), 0);
    const paidBillings = allBillings.filter(b => b.status === "pago").reduce((s, b) => s + parseFloat(b.totalAmount), 0);
    const pendingBillings = allBillings.filter(b => b.status === "pendente").reduce((s, b) => s + parseFloat(b.totalAmount), 0);

    const receivedRows = await db.select({ amount: revenuesTable.amount }).from(revenuesTable)
      .where(and(eq(revenuesTable.userId, userId), eq(revenuesTable.clientId, client.id), eq(revenuesTable.status, "recebido")));
    const totalReceived = receivedRows.reduce((s, r) => s + parseFloat(r.amount), 0);

    const pendingRevenueRows = await db.select({ amount: revenuesTable.amount }).from(revenuesTable)
      .where(and(eq(revenuesTable.userId, userId), eq(revenuesTable.clientId, client.id), eq(revenuesTable.status, "pendente")));
    const pendingRevenues = pendingRevenueRows.reduce((s, r) => s + parseFloat(r.amount), 0);

    const expenseRows = await db.select({ amount: expensesTable.amount }).from(expensesTable)
      .where(and(eq(expensesTable.userId, userId), eq(expensesTable.clientId, client.id)));
    const totalExpenses = expenseRows.reduce((s, e) => s + parseFloat(e.amount), 0);

    const pendingAmount = pendingBillings + pendingRevenues;
    const netProfit = totalReceived - totalExpenses;
    const margin = totalReceived > 0 ? (netProfit / totalReceived) * 100 : 0;

    result.push({
      clientId: client.id,
      clientName: client.name,
      totalBilled,
      totalPaid: totalReceived,
      paidBillings,
      totalReceived,
      totalExpenses,
      netProfit,
      margin,
      pendingAmount,
      billingCount: allBillings.length,
      revenueCount: receivedRows.length,
      expenseCount: expenseRows.length,
    });
  }

  result.sort((a, b) => b.netProfit - a.netProfit);
  res.json(result);
});

export default router;
