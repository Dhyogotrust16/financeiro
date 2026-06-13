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
import { useAuth } from "@clerk/react";

const billingSchema = z.object({
  clientId: z.coerce.number().min(1, "Selecione um cliente"),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2099),
});

type BillingForm = z.infer<typeof billingSchema>;

const MONTHS = [
  { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" }, { value: 4, label: "Abril" },
  { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
  { value: 7, label: "Julho" }, { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" }, { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
];

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

  const now = new Date();
  const form = useForm<BillingForm>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      clientId: 0,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListBillingsQueryKey() });
  }

  function handleCreate(values: BillingForm) {
    createBilling.mutate(
      { data: values },
      {
        onSuccess: () => {
          invalidate();
          setIsCreateOpen(false);
          form.reset();
          toast({ title: "Cobrança gerada", description: "O fechamento mensal foi criado com sucesso." });
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

  async function handleDownloadPdf(billingId: number, clientName: string | null, month: number, year: number) {
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
      a.download = `cobranca-${(clientName ?? "cliente").replace(/\s+/g, "-").toLowerCase()}-${month}-${year}.pdf`;
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

      <Dialog open={isCreateOpen} onOpenChange={(o) => { if (!o) form.reset(); setIsCreateOpen(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Cobrança</DialogTitle>
            <DialogDescription>
              Gera um fechamento mensal com honorário + despesas a repassar do período.
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
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mês</FormLabel>
                      <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MONTHS.map((m) => (
                            <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano</FormLabel>
                      <FormControl><Input type="number" min="2020" max="2099" {...field} /></FormControl>
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
              ) : !billings?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma cobrança encontrada. Clique em "Nova Cobrança" para gerar um fechamento mensal.
                  </TableCell>
                </TableRow>
              ) : (
                billings.map((billing) => (
                  <TableRow key={billing.id}>
                    <TableCell className="font-medium">{billing.month}/{billing.year}</TableCell>
                    <TableCell>{billing.clientName}</TableCell>
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
                          onClick={() => handleDownloadPdf(billing.id, billing.clientName ?? null, billing.month, billing.year)}
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
                                  A cobrança de {billing.month}/{billing.year} para {billing.clientName} será excluída e as despesas serão liberadas.
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
