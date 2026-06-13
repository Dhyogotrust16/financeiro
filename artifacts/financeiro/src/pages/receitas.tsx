import { useListRevenues } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Receitas() {
  const { data: revenues, isLoading } = useListRevenues();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Receitas</h1>
        <p className="text-muted-foreground">Gestão de todas as receitas recebidas e pendentes</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  </TableRow>
                ))
              ) : !revenues?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma receita encontrada
                  </TableCell>
                </TableRow>
              ) : (
                revenues.map((revenue) => (
                  <TableRow key={revenue.id}>
                    <TableCell>{formatDate(revenue.date)}</TableCell>
                    <TableCell className="font-medium">{revenue.description}</TableCell>
                    <TableCell className="text-muted-foreground">{revenue.clientName || '-'}</TableCell>
                    <TableCell className="text-right font-medium text-green-600 dark:text-green-500">
                      {formatCurrency(revenue.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={revenue.status === 'recebido' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}>
                        {revenue.status.toUpperCase()}
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