import { useListBillings } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Cobrancas() {
  const { data: billings, isLoading } = useListBillings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cobranças</h1>
        <p className="text-muted-foreground">Gestão de fechamentos mensais e faturas</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês/Ano</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  </TableRow>
                ))
              ) : !billings?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma cobrança encontrada
                  </TableCell>
                </TableRow>
              ) : (
                billings.map((billing) => (
                  <TableRow key={billing.id}>
                    <TableCell>{billing.month}/{billing.year}</TableCell>
                    <TableCell className="font-medium">{billing.clientName}</TableCell>
                    <TableCell>{formatDate(billing.dueDate)}</TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {formatCurrency(billing.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        billing.status === 'pago' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                        billing.status === 'atrasado' ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                      }>
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