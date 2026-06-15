import { useGetClientProfitability, useGetDashboardCashflow } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function Relatorios() {
  const { data: profitability, isLoading: isLoadingProfitability } = useGetClientProfitability();
  const { data: cashflow, isLoading: isLoadingCashflow } = useGetDashboardCashflow();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">Análises detalhadas do desempenho financeiro</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lucratividade por Cliente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Faturado</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingProfitability ? (
                  <TableRow><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : (
                  (Array.isArray(profitability) ? profitability : []).map(p => (
                    <TableRow key={p.clientId}>
                      <TableCell className="font-medium">{p.clientName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.totalBilled)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(p.totalPaid)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Fluxo de Caixa</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
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
                  (Array.isArray(cashflow) ? cashflow : []).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.label}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(c.revenue)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(c.expenses)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(c.balance)}</TableCell>
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