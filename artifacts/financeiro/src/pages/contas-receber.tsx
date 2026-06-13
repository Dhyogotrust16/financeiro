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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, AlertCircle, Banknote, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const markPaidSchema = z.object({
  paidAt: z.string().min(1, "Data de recebimento obrigatória"),
});
type MarkPaidForm = z.infer<typeof markPaidSchema>;

type StatusFilter = "" | "pendente" | "pago";

export default function ContasReceber() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const markBillingPaid = useMarkBillingPaid();

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const [markingId, setMarkingId] = useState<number | null>(null);
  const [period, setPeriod] = useState<PeriodValue | null>({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

  const periodParams = period ? periodToDates(period) : {};
  const queryParams = {
    ...periodParams,
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const { data: billings, isLoading } = useListBillings(queryParams);

  const form = useForm<MarkPaidForm>({
    resolver: zodResolver(markPaidSchema),
    defaultValues: { paidAt: today },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListBillingsQueryKey() });
  }

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
          invalidate();
          setMarkingId(null);
          toast({ title: "Pagamento registrado", description: "Cobrança marcada como recebida." });
        },
        onError: () =>
          toast({ title: "Erro", description: "Não foi possível registrar o recebimento.", variant: "destructive" }),
      }
    );
  }

  const markingBilling = billings?.find((b) => b.id === markingId);

  // Compute overdue client-side (API returns "pendente" for overdue in DB)
  const enriched = (billings ?? []).map((b) => ({
    ...b,
    displayStatus: b.status === "pendente" && b.dueDate < today ? "atrasado" : b.status,
  }));

  const totalPendente = enriched
    .filter((b) => b.displayStatus === "pendente" || b.displayStatus === "atrasado")
    .reduce((s, b) => s + b.totalAmount, 0);
  const totalPago = enriched
    .filter((b) => b.displayStatus === "pago")
    .reduce((s, b) => s + b.totalAmount, 0);
  const countPendente = enriched.filter((b) => b.displayStatus === "pendente" || b.displayStatus === "atrasado").length;

  // Client breakdown (only pending/overdue)
  const byClient: Record<string, { name: string; total: number; count: number }> = {};
  enriched
    .filter((b) => b.displayStatus !== "pago")
    .forEach((b) => {
      const key = b.clientName || "Sem cliente";
      if (!byClient[key]) byClient[key] = { name: key, total: 0, count: 0 };
      byClient[key].total += b.totalAmount;
      byClient[key].count++;
    });
  const clientBreakdown = Object.values(byClient).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contas a Receber</h1>
          <p className="text-muted-foreground">Faturas e cobranças pendentes de recebimento</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        <div className="flex rounded-lg border bg-background text-sm overflow-hidden">
          {(["", "pendente", "pago"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                "px-3 py-1.5 font-medium transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {s === "" ? "Todos" : s === "pendente" ? "Pendente" : "Recebido"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Receber (Pendente)</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-32" /> : (
              <>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalPendente)}</p>
                <p className="text-xs text-muted-foreground mt-1">{countPendente} cobrança{countPendente !== 1 ? "s" : ""}</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Já Recebido</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-32" /> : (
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPago)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-16" /> : (
              <>
                <p className="text-2xl font-bold">{clientBreakdown.length}</p>
                <p className="text-xs text-muted-foreground mt-1">com saldo pendente</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mark as Received Dialog */}
      <Dialog open={!!markingId} onOpenChange={(o) => { if (!o) setMarkingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Recebimento</DialogTitle>
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
                <Button
                  type="submit"
                  disabled={markBillingPaid.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                >
                  <Banknote className="h-4 w-4" />
                  {markBillingPaid.isPending ? "Salvando..." : "Confirmar Recebimento"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main table */}
        <div className="lg:col-span-2">
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
                    <TableHead className="w-[120px] text-right">Ações</TableHead>
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
                  ) : !enriched.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle2 className="h-8 w-8 text-green-500 opacity-60" />
                          <span>Nenhuma conta a receber pendente. Tudo em dia!</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    enriched.map((billing) => {
                      const isOverdue = billing.displayStatus === "atrasado";
                      const isPaid = billing.displayStatus === "pago";
                      return (
                        <TableRow
                          key={billing.id}
                          className={isOverdue ? "bg-red-50/50 dark:bg-red-950/10" : ""}
                        >
                          <TableCell className={isOverdue ? "font-medium text-red-600 dark:text-red-400" : ""}>
                            {formatDate(billing.dueDate)}
                          </TableCell>
                          <TableCell className="font-medium">{billing.clientName}</TableCell>
                          <TableCell className="text-muted-foreground">{billing.month}/{billing.year}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatCurrency(billing.monthlyFee)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatCurrency(billing.expensesTotal)}</TableCell>
                          <TableCell className="text-right font-semibold text-primary">{formatCurrency(billing.totalAmount)}</TableCell>
                          <TableCell>
                            {isPaid ? (
                              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                                Recebido {billing.paidAt ? `em ${formatDate(billing.paidAt)}` : ""}
                              </Badge>
                            ) : isOverdue ? (
                              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400">
                                Atrasado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!isPaid && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white gap-1 h-7 px-2 text-xs"
                                onClick={() => openMarkPaid(billing.id)}
                              >
                                <Banknote className="h-3.5 w-3.5" />
                                Receber
                              </Button>
                            )}
                            {isPaid && billing.paidAt && (
                              <span className="text-xs text-muted-foreground">{formatDate(billing.paidAt)}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
                {!isLoading && !!enriched.length && (
                  <TableFooter>
                    <TableRow className="font-semibold border-t-2">
                      <TableCell colSpan={5} className="text-right text-muted-foreground">Total Pendente</TableCell>
                      <TableCell className="text-right text-amber-600 dark:text-amber-400">
                        {formatCurrency(totalPendente)}
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Client breakdown sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Pendente por Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))
              ) : !clientBreakdown.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pendência</p>
              ) : (
                clientBreakdown.map((c) => (
                  <div key={c.name} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.count} cobrança{c.count !== 1 ? "s" : ""}</p>
                    </div>
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                      {formatCurrency(c.total)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
