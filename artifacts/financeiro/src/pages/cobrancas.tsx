import { useState } from "react";
import { useListBillings } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";

export default function Cobrancas() {
  const { data: billings, isLoading } = useListBillings();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  async function handleDownloadPdf(billingId: number, clientName: string | null, month: number, year: number) {
    setDownloadingId(billingId);
    try {
      const token = await getToken();
      const res = await fetch(`/api/billings/${billingId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Falha ao gerar PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cobranca-${(clientName ?? "cliente").replace(/\s+/g, "-").toLowerCase()}-${month}-${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "PDF gerado com sucesso", description: `Cobrança ${month}/${year} baixada.` });
    } catch {
      toast({ title: "Erro ao gerar PDF", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  }

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
                <TableHead className="text-right">Honorário</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !billings?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma cobrança encontrada
                  </TableCell>
                </TableRow>
              ) : (
                billings.map((billing) => (
                  <TableRow key={billing.id}>
                    <TableCell className="font-medium">
                      {billing.month}/{billing.year}
                    </TableCell>
                    <TableCell>{billing.clientName}</TableCell>
                    <TableCell>{formatDate(billing.dueDate)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(billing.monthlyFee)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(billing.expensesTotal)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {formatCurrency(billing.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          billing.status === "pago"
                            ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400"
                            : billing.status === "atrasado"
                            ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                        }
                      >
                        {billing.status === "pago" ? "Pago" : billing.status === "atrasado" ? "Atrasado" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Baixar PDF"
                        disabled={downloadingId === billing.id}
                        onClick={() => handleDownloadPdf(billing.id, billing.clientName ?? null, billing.month, billing.year)}
                      >
                        {downloadingId === billing.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4" />
                        )}
                      </Button>
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
