import { useMemo, useState } from "react";
import { useListExpenses, useListRevenues, getListExpensesQueryKey, getListRevenuesQueryKey } from "@workspace/api-client-react";
import { PeriodFilter, periodToDates, type PeriodValue } from "@/components/period-filter";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function getEndOfPreviousDay(period: PeriodValue) {
  const date = new Date(period.year, period.month - 1, 1);
  date.setDate(date.getDate() - 1);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatLedgerCurrency(value: number | undefined | null) {
  if (value === undefined || value === null || value === 0) {
    return "-";
  }
  return formatCurrency(value);
}

export default function LivroCaixa() {
  const now = new Date();
  const [period, setPeriod] = useState<PeriodValue | null>({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const periodParams = period ? periodToDates(period) : {};
  const priorEndDate = period ? getEndOfPreviousDay(period) : undefined;

  const { data: expenses } = useListExpenses(periodParams);
  const { data: revenues } = useListRevenues(periodParams);
  const priorExpensesQueryKey = getListExpensesQueryKey(priorEndDate ? { endDate: priorEndDate } : undefined);
  const priorRevenuesQueryKey = getListRevenuesQueryKey(priorEndDate ? { endDate: priorEndDate } : undefined);

  const { data: priorExpenses } = useListExpenses(
    priorEndDate ? { endDate: priorEndDate } : undefined,
    { query: { queryKey: priorExpensesQueryKey, enabled: !!priorEndDate } }
  );
  const { data: priorRevenues } = useListRevenues(
    priorEndDate ? { endDate: priorEndDate } : undefined,
    { query: { queryKey: priorRevenuesQueryKey, enabled: !!priorEndDate } }
  );

  type LedgerRow = {
    id: string;
    date: string;
    description: string;
    category: string;
    client: string;
    entry: number;
    exit: number;
    balance: number;
    isPrevious?: boolean;
  };

  const entries = useMemo(() => {
    const expenseRows: LedgerRow[] = Array.isArray(expenses)
      ? expenses.map((expense) => ({
          id: `expense-${expense.id}`,
          date: expense.date,
          description: expense.description,
          category: expense.categoryName ?? "",
          client: expense.clientName ?? "",
          entry: 0,
          exit: expense.amount,
          balance: 0,
        }))
      : [];

    const revenueRows: LedgerRow[] = Array.isArray(revenues)
      ? revenues.map((revenue) => ({
          id: `revenue-${revenue.id}`,
          date: revenue.date,
          description: revenue.description,
          category: "",
          client: revenue.clientName ?? "",
          entry: revenue.amount,
          exit: 0,
          balance: 0,
        }))
      : [];

    const sortedRows = [...expenseRows, ...revenueRows].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.id.localeCompare(b.id);
    });

    const previousBalance = period
      ? (Array.isArray(priorRevenues) ? priorRevenues.reduce((sum, item) => sum + item.amount, 0) : 0)
        - (Array.isArray(priorExpenses) ? priorExpenses.reduce((sum, item) => sum + item.amount, 0) : 0)
      : 0;

    let runningBalance = previousBalance;

    const mergedRows = sortedRows.map((row) => {
      runningBalance += row.entry - row.exit;
      return {
        ...row,
        balance: runningBalance,
      };
    });

    if (period && previousBalance !== 0) {
      return [
        {
          id: "previous-balance",
          date: "",
          description: "Saldo anterior",
          category: "",
          client: "",
          entry: 0,
          exit: 0,
          balance: previousBalance,
          isPrevious: true,
        },
        ...mergedRows,
      ];
    }

    return mergedRows;
  }, [expenses, revenues, priorExpenses, priorRevenues, period]);

  const totalEntry = entries.reduce((sum, row) => sum + row.entry, 0);
  const totalExit = entries.reduce((sum, row) => sum + row.exit, 0);
  const finalBalance = entries.length > 0 ? entries[entries.length - 1].balance : 0;
  const periodLabel = period ? `${MONTH_LABELS[period.month - 1]} ${period.year}` : "Todos os períodos";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Livro Caixa</h1>
          <p className="text-muted-foreground">Movimento de caixa com entradas, saídas e saldo acumulado.</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimento do Caixa — {periodLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted p-4">
              <p className="text-sm text-muted-foreground">Total de Entradas</p>
              <p className="text-xl font-semibold text-emerald-700">{formatCurrency(totalEntry)}</p>
            </div>
            <div className="rounded-lg border bg-muted p-4">
              <p className="text-sm text-muted-foreground">Total de Saídas</p>
              <p className="text-xl font-semibold text-rose-700">{formatCurrency(totalExit)}</p>
            </div>
            <div className="rounded-lg border bg-muted p-4">
              <p className="text-sm text-muted-foreground">Saldo Final</p>
              <p className={`text-xl font-semibold ${finalBalance < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                {formatCurrency(finalBalance)}
              </p>
            </div>
          </div>

          <div className="max-h-[520px] overflow-auto border border-border rounded-xl">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição / Categoria</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">Saída</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                      Nenhum lançamento encontrado para este período.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((row) => (
                    <TableRow key={row.id} className={row.isPrevious ? "bg-muted/50 font-semibold" : undefined}>
                      <TableCell>{row.date ? formatDate(row.date) : ""}</TableCell>
                      <TableCell>
                        <div>{row.description}</div>
                        {row.category ? <div className="text-sm text-muted-foreground">{row.category}</div> : null}
                      </TableCell>
                      <TableCell>{row.client}</TableCell>
                      <TableCell className="text-right text-emerald-700">{formatLedgerCurrency(row.entry)}</TableCell>
                      <TableCell className="text-right text-rose-700">{formatLedgerCurrency(row.exit)}</TableCell>
                      <TableCell className={`text-right ${row.balance < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                        {formatCurrency(row.balance)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
