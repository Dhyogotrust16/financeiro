import { useListBillings } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function ContasReceber() {
  const { data: billings, isLoading } = useListBillings({ status: 'pendente' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contas a Receber</h1>
        <p className="text-muted-foreground">Faturas e cobranças pendentes de recebimento</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : !billings?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma conta a receber pendente
                  </TableCell>
                </TableRow>
              ) : (
                billings.map((billing) => (
                  <TableRow key={billing.id}>
                    <TableCell>{formatDate(billing.dueDate)}</TableCell>
                    <TableCell className="font-medium">{billing.clientName}</TableCell>
                    <TableCell>{billing.month}/{billing.year}</TableCell>
                    <TableCell className="text-right font-bold text-amber-600 dark:text-amber-500">
                      {formatCurrency(billing.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        {billing.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}