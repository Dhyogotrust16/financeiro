import {
  useListExpenses,
} from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Receipt, ArrowUpCircle, Clock } from "lucide-react";

export default function ContasPagar() {
  const { data: expenses, isLoading } = useListExpenses({ passToClient: false });

  const totalGeral = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;

  // Group by category for subtotals
  const byCategory: Record<string, { name: string; total: number; count: number }> = {};
  expenses?.forEach((e) => {
    const key = e.categoryName || "Geral";
    if (!byCategory[key]) byCategory[key] = { name: key, total: 0, count: 0 };
    byCategory[key].total += e.amount;
    byCategory[key].count++;
  });
  const categories = Object.values(byCategory).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contas a Pagar</h1>
        <p className="text-muted-foreground">Despesas internas do escritório não repassadas a clientes</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Despesas</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalGeral)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quantidade</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <>
                <p className="text-2xl font-bold">{expenses?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">lançamentos</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categorias</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <>
                <p className="text-2xl font-bold">{categories.length}</p>
                <p className="text-xs text-muted-foreground mt-1">categorias distintas</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main table */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : !expenses?.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhuma despesa interna encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="text-muted-foreground">{formatDate(expense.date)}</TableCell>
                        <TableCell className="font-medium">{expense.description}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{expense.categoryName || 'Geral'}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600 dark:text-red-500">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {!isLoading && !!expenses?.length && (
                  <TableFooter>
                    <TableRow className="font-semibold border-t-2">
                      <TableCell colSpan={3} className="text-right text-muted-foreground">Total</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400 text-base">
                        {formatCurrency(totalGeral)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Category breakdown */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Por Categoria</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : !categories.length ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sem dados</p>
              ) : (
                <div className="divide-y">
                  {categories.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{cat.name}</p>
                        <p className="text-xs text-muted-foreground">{cat.count} lançamento{cat.count !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(cat.total)}
                        </p>
                        {totalGeral > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {((cat.total / totalGeral) * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
