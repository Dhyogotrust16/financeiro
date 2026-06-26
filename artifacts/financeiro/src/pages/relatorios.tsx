import { useGetClientProfitability, useGetDashboardCashflow } from "@workspace/api-client-react";
import { useMemo } from "react";
import { Download, FileText, Printer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";

interface ProfitabilityRow {
  clientId: number;
  clientName: string;
  totalBilled: number;
  totalPaid: number;
  paidBillings?: number;
  totalReceived?: number;
  totalExpenses?: number;
  netProfit?: number;
  margin?: number;
  pendingAmount: number;
  billingCount: number;
  revenueCount?: number;
  expenseCount?: number;
}

interface StoredHonorario {
  clientId: number;
  clientName: string;
  amount: number;
  payments?: Array<{ amount: number }>;
}

const HONORARIOS_STORAGE_KEY = "financeiro-honorarios";

function readStoredHonorarios(): StoredHonorario[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(HONORARIOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredHonorario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function honorarioPaidTotal(honorario: StoredHonorario) {
  return (honorario.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
}

function percent(value: number | undefined) {
  return `${Number(value ?? 0).toFixed(1).replace(".", ",")}%`;
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadBlob(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function exportProfitabilityCsv(rows: ProfitabilityRow[]) {
  const header = [
    "Cliente",
    "Faturado",
    "Recebido",
    "Pendente",
    "Despesas",
    "Lucro liquido",
    "Margem",
    "Cobrancas",
    "Receitas",
    "Despesas lancadas",
  ];
  const body = rows.map((row) => [
    row.clientName,
    row.totalBilled,
    row.totalPaid,
    row.pendingAmount,
    row.totalExpenses ?? 0,
    row.netProfit ?? row.totalPaid - (row.totalExpenses ?? 0),
    percent(row.margin),
    row.billingCount,
    row.revenueCount ?? 0,
    row.expenseCount ?? 0,
  ]);
  const csv = [header, ...body].map((line) => line.map(csvCell).join(";")).join("\n");
  downloadBlob("lucratividade-clientes.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

function exportCashflowCsv(rows: any[]) {
  const header = ["Periodo", "Receitas", "Despesas", "Saldo"];
  const body = rows.map((row) => [row.label, row.revenue, row.expenses, row.balance]);
  const csv = [header, ...body].map((line) => line.map(csvCell).join(";")).join("\n");
  downloadBlob("fluxo-caixa.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

function printReport(rows: ProfitabilityRow[], cashflow: any[]) {
  const html = `
    <html>
      <head>
        <title>Relatorio financeiro</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { margin: 0 0 4px; }
          p { margin: 0 0 24px; color: #4b5563; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 12px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: right; }
          th:first-child, td:first-child { text-align: left; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>Relatorio financeiro</h1>
        <p>Lucratividade por cliente e fluxo de caixa</p>
        <h2>Lucratividade por cliente</h2>
        <table>
          <thead>
            <tr>
              <th>Cliente</th><th>Faturado</th><th>Recebido</th><th>Pendente</th><th>Despesas</th><th>Lucro liquido</th><th>Margem</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${row.clientName}</td>
                <td>${formatCurrency(row.totalBilled)}</td>
                <td>${formatCurrency(row.totalPaid)}</td>
                <td>${formatCurrency(row.pendingAmount)}</td>
                <td>${formatCurrency(row.totalExpenses ?? 0)}</td>
                <td>${formatCurrency(row.netProfit ?? row.totalPaid - (row.totalExpenses ?? 0))}</td>
                <td>${percent(row.margin)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <h2>Fluxo de caixa</h2>
        <table>
          <thead><tr><th>Periodo</th><th>Receitas</th><th>Despesas</th><th>Saldo</th></tr></thead>
          <tbody>
            ${cashflow.map((row) => `
              <tr>
                <td>${row.label}</td>
                <td>${formatCurrency(row.revenue)}</td>
                <td>${formatCurrency(row.expenses)}</td>
                <td>${formatCurrency(row.balance)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <script>window.print();</script>
      </body>
    </html>
  `;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export default function Relatorios() {
  const { data: profitability, isLoading: isLoadingProfitability } = useGetClientProfitability({
    query: { staleTime: 0, refetchOnMount: "always" } as any,
  });
  const { data: cashflow, isLoading: isLoadingCashflow } = useGetDashboardCashflow({
    query: { staleTime: 0, refetchOnMount: "always" } as any,
  });

  const storedHonorarios = useMemo(() => readStoredHonorarios(), []);
  const profitabilityRows = useMemo(() => {
    const rows = new Map<number, ProfitabilityRow>();

    ((Array.isArray(profitability) ? profitability : []) as ProfitabilityRow[]).forEach((row) => {
      rows.set(row.clientId, { ...row });
    });

    storedHonorarios.forEach((honorario) => {
      const paid = honorarioPaidTotal(honorario);
      const pending = Math.max(0, Number(honorario.amount ?? 0) - paid);
      const current = rows.get(honorario.clientId) ?? {
        clientId: honorario.clientId,
        clientName: honorario.clientName,
        totalBilled: 0,
        totalPaid: 0,
        pendingAmount: 0,
        billingCount: 0,
        revenueCount: 0,
        expenseCount: 0,
        totalExpenses: 0,
      };
      const received = Math.max(Number(current.totalPaid ?? 0), paid);
      const expenses = Number(current.totalExpenses ?? 0);
      const netProfit = received - expenses;

      rows.set(honorario.clientId, {
        ...current,
        clientName: current.clientName || honorario.clientName,
        totalBilled: Number(current.totalBilled ?? 0) + Number(honorario.amount ?? 0),
        totalPaid: received,
        pendingAmount: Number(current.pendingAmount ?? 0) + pending,
        netProfit,
        margin: received > 0 ? (netProfit / received) * 100 : 0,
        revenueCount: Math.max(Number(current.revenueCount ?? 0), paid > 0 ? 1 : 0),
      });
    });

    return Array.from(rows.values()).sort((a, b) => {
      const profitA = Number(a.netProfit ?? a.totalPaid - (a.totalExpenses ?? 0));
      const profitB = Number(b.netProfit ?? b.totalPaid - (b.totalExpenses ?? 0));
      return profitB - profitA;
    });
  }, [profitability, storedHonorarios]);
  const cashflowRows = Array.isArray(cashflow) ? cashflow : [];
  const totalReceived = profitabilityRows.reduce((sum, row) => sum + row.totalPaid, 0);
  const totalExpenses = profitabilityRows.reduce((sum, row) => sum + Number(row.totalExpenses ?? 0), 0);
  const totalProfit = profitabilityRows.reduce((sum, row) => sum + Number(row.netProfit ?? row.totalPaid - (row.totalExpenses ?? 0)), 0);
  const totalPending = profitabilityRows.reduce((sum, row) => sum + row.pendingAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">Análises detalhadas do desempenho financeiro</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportProfitabilityCsv(profitabilityRows)}>
            <Download className="h-4 w-4" />
            Planilha clientes
          </Button>
          <Button variant="outline" onClick={() => exportCashflowCsv(cashflowRows)}>
            <FileText className="h-4 w-4" />
            Planilha caixa
          </Button>
          <Button onClick={() => printReport(profitabilityRows, cashflowRows)}>
            <Printer className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Recebido por clientes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(totalReceived)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Despesas vinculadas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Lucro líquido</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalProfit)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pendente</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Lucratividade por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Faturado</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Lucro líquido</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right">Lançamentos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingProfitability ? (
                  <TableRow><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : profitabilityRows.length ? (
                  profitabilityRows.map((row) => {
                    const netProfit = row.netProfit ?? row.totalPaid - (row.totalExpenses ?? 0);
                    return (
                      <TableRow key={row.clientId}>
                        <TableCell className="font-medium">{row.clientName}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.totalBilled)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(row.totalPaid)}</TableCell>
                        <TableCell className="text-right text-amber-600">{formatCurrency(row.pendingAmount)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(row.totalExpenses ?? 0)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(netProfit)}</TableCell>
                        <TableCell className="text-right">{percent(row.margin)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.billingCount} cob. / {row.revenueCount ?? 0} rec. / {row.expenseCount ?? 0} desp.
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Nenhum dado encontrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Fluxo de Caixa</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[460px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Receitas</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingCashflow ? (
                  <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : (
                  cashflowRows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(row.revenue)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(row.expenses)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(row.balance)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
