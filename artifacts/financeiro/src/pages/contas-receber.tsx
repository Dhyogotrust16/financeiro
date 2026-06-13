import { useState } from "react";
import {
  useListBillings,
  useMarkBillingPaid,
  getListBillingsQueryKey,
} from "@workspace/api-client-react";
import { PeriodFilter, periodToDates, type PeriodValue } from "@/components/period-filter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, AlertCircle, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const markPaidSchema = z.object({
  paidAt: z.string().min(1, "Data de pagamento obrigatória"),
});
type MarkPaidForm = z.infer<typeof markPaidSchema>;

export default function ContasReceber() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const markBillingPaid = useMarkBillingPaid();

  const [markingId, setMarkingId] = useState<number | null>(null);
  const [period, setPeriod] = useState<PeriodValue | null>(null);

  const periodParams = period ? periodToDates(period) : {};

  // Load pending + overdue separately so we get both
  const { data: pending, isLoading: isPendingLoading } = useListBillings({ status: "pendente", ...periodParams });
  const { data: overdue, isLoading: isOverdueLoading } = useListBillings({ status: "atrasado", ...periodParams });

  const isLoading = isPendingLoading || isOverdueLoading;

  // Merge and sort by dueDate asc (most urgent first)
  const billings = [...(pending ?? []), ...(overdue ?? [])].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate)
  );

  const totalPending = billings
    .filter((b) => b.status === "pendente")
    .reduce((s, b) => s + b.totalAmount, 0);
  const totalOverdue = billings
    .filter((b) => b.status === "atrasado")
    .reduce((s, b) => s + b.totalAmount, 0);
  const totalAll = totalPending + totalOverdue;

  const today = new Date().toISOString().split("T")[0];

  const form = useForm<MarkPaidForm>({
    resolver: zodResolver(markPaidSchema),
    defaultValues: { paidAt: today },
  });

  function openMarkPaid(id: number) {
    form.reset({ paidAt: today });
    setMarkingId(id);
  }

  function handleMarkPaid(values: MarkPaidForm) {
    if (!markingId) return;
    markBillingPaid.mutate(
      { id: markingId, data: { paidAt: values.paidAt } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBillingsQueryKey() });
          setMarkingId(null);
          toast({ title: "Pagamento registrado", description: "Cobrança marcada como paga." });
        },
        onError: () =>
          toast({ title: "Erro", description: "Não foi possível registrar o pagamento.", variant: "destructive" }),
      }
    );
  }

  const markingBilling = billings.find((b) => b.id === markingId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contas a Receber</h1>
          <p className="text-muted-foreground">Faturas e cobranças pendentes de recebimento</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total a Receber</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalAll)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendente</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalPending)}</p>
                <p className="text-xs text-muted-foreground mt-1">{pending?.length ?? 0} cobranças</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Atrasado</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalOverdue)}</p>
                <p className="text-xs text-muted-foreground mt-1">{overdue?.length ?? 0} cobranças</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mark as Paid Dialog */}
      <Dialog open={!!markingId} onOpenChange={(o) => { if (!o) setMarkingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              {markingBilling
                ? `${markingBilling.clientName} — ${markingBilling.month}/${markingBilling.year} — ${formatCurrency(markingBilling.totalAmount)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleMarkPaid)} className="space-y-4">
              <FormField
                control={form.control}
                name="paidAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Recebimento</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setMarkingId(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={markBillingPaid.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                  {markBillingPaid.isPending ? "Salvando..." : "Confirmar Pagamento"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead className="text-right">Honorário</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px] text-right">Ações</TableHead>
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
              ) : !billings.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <span>Nenhuma conta a receber pendente. Tudo em dia!</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                billings.map((billing) => (
                  <TableRow
                    key={billing.id}
                    className={billing.status === "atrasado" ? "bg-red-50/50 dark:bg-red-950/10" : ""}
                  >
                    <TableCell className={billing.status === "atrasado" ? "font-medium text-red-600 dark:text-red-400" : ""}>
                      {formatDate(billing.dueDate)}
                    </TableCell>
                    <TableCell className="font-medium">{billing.clientName}</TableCell>
                    <TableCell className="text-muted-foreground">{billing.month}/{billing.year}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(billing.monthlyFee)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(billing.expensesTotal)}</TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(billing.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          billing.status === "atrasado"
                            ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                        }
                      >
                        {billing.status === "atrasado" ? "Atrasado" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                        onClick={() => openMarkPaid(billing.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Recebido
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
