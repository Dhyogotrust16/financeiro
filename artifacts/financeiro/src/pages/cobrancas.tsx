import { useState } from "react";
import {
  useListBillings,
  useCreateBilling,
  useDeleteBilling,
  useMarkBillingPaid,
  useListClients,
  getListBillingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, CheckCircle2, FileDown, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

const billingSchema = z.object({
  clientId: z.coerce.number().min(1, "Selecione um cliente"),
  amount: z.coerce.number().min(0.01, "Informe um valor maior que zero"),
  dueDate: z.string().min(1, "Selecione a data de vencimento"),
});

type BillingForm = z.infer<typeof billingSchema>;

function getBillingDefaults(): BillingForm {
  const now = new Date();
  return {
    clientId: 0,
    amount: 0,
    dueDate: format(now, "yyyy-MM-dd"),
  };
}

export default function Cobrancas() {
  const { data: billings, isLoading } = useListBillings();
  const { data: clients } = useListClients();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getToken } = useAuth();

  const createBilling = useCreateBilling();
  const deleteBilling = useDeleteBilling();
  const markBillingPaid = useMarkBillingPaid();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const form = useForm<BillingForm>({
    resolver: zodResolver(billingSchema),
    defaultValues: getBillingDefaults(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListBillingsQueryKey() });
  }

  function handleCreate(values: BillingForm) {
    createBilling.mutate(
      { data: { clientId: values.clientId, dueDate: values.dueDate, amount: values.amount } },
      {
        onSuccess: () => {
          invalidate();
          setIsCreateOpen(false);
          form.reset(getBillingDefaults());
          toast({ title: "Cobrança gerada", description: "A conta a receber foi criada com sucesso." });
        },
        onError: (e: any) => {
          const msg = e?.response?.data?.error ?? "Não foi possível gerar a cobrança.";
          toast({ title: "Erro", description: msg, variant: "destructive" });
        },
      }
    );
  }

  function handleMarkPaid(id: number) {
    const paidAt = new Date().toISOString().split("T")[0];
    markBillingPaid.mutate(
      { id, data: { paidAt } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Cobrança marcada como paga" });
        },
        onError: () => toast({ title: "Erro", variant: "destructive" }),
      }
    );
  }

  function handleDelete(id: number) {
    deleteBilling.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Cobrança excluída" });
        },
        onError: () => toast({ title: "Erro", description: "Não é possível excluir cobranças pagas.", variant: "destructive" }),
      }
    );
  }

  async function handleDownloadPdf(billingId: number, label: string | null, month: number, year: number) {
    setDownloadingId(billingId);
    try {
      const token = await getToken();
      const res = await fetch(`/api/billings/${billingId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Falha ao gerar PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cobranca-${(label ?? "cobranca").replace(/\s+/g, "-").toLowerCase()}-${month}-${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF gerado", description: `Cobrança ${month}/${year} baixada.` });
    } catch {
      toast({ title: "Erro ao gerar PDF", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cobranças</h1>
          <p className="text-muted-foreground">Gestão de fechamentos mensais e faturas</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova Cobrança
        </Button>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={(o) => { if (!o) form.reset(getBillingDefaults()); setIsCreateOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Cobrança</DialogTitle>
            <DialogDescription>
              Preencha os dados da cobrança e defina o vencimento.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients?.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0.01" placeholder="0,00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vencimento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={createBilling.isPending}>
                  {createBilling.isPending ? "Gerando..." : "Gerar Cobrança"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês/Ano</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
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
              ) : !billings?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma cobrança encontrada. Clique em "Nova Cobrança" para gerar um fechamento mensal.
                  </TableCell>
                </TableRow>
              ) : (
                (Array.isArray(billings) ? billings : []).map((billing) => (
                  <TableRow key={billing.id}>
                    <TableCell className="font-medium">{billing.month}/{billing.year}</TableCell>
                    <TableCell>{billing.clientName ?? billing.description ?? "-"}</TableCell>
                    <TableCell>{formatDate(billing.dueDate)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(billing.monthlyFee)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(billing.expensesTotal)}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{formatCurrency(billing.totalAmount)}</TableCell>
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {billing.status !== "pago" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Marcar como pago"
                            onClick={() => handleMarkPaid(billing.id)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Baixar PDF"
                          disabled={downloadingId === billing.id}
                          onClick={() => handleDownloadPdf(billing.id, billing.clientName ?? billing.description ?? null, billing.month, billing.year)}
                        >
                          {downloadingId === billing.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <FileDown className="h-4 w-4" />}
                        </Button>
                        {billing.status !== "pago" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir cobrança?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  A cobrança de {billing.month}/{billing.year} para {billing.clientName ?? billing.description ?? "este lançamento"} será excluída e as despesas serão liberadas.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(billing.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
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
