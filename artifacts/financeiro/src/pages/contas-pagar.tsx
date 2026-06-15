import { useState } from "react";
import {
  useListPayables,
  useCreatePayable,
  useUpdatePayable,
  useDeletePayable,
  usePayPayable,
  useListCategories,
  getListPayablesQueryKey,
  getListExpensesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  TableFooter,
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
import { Plus, Trash2, Pencil, ArrowUpCircle, Receipt, Clock, CheckCircle2, Banknote } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PeriodFilter, periodToDates, type PeriodValue } from "@/components/period-filter";

const payableSchema = z.object({
  description: z.string().min(2, "Descrição obrigatória"),
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  dueDate: z.string().min(1, "Vencimento obrigatório"),
  categoryId: z.coerce.number().optional().nullable(),
});

const paySchema = z.object({
  paidAt: z.string().min(1, "Data obrigatória"),
});

type PayableForm = z.infer<typeof payableSchema>;
type PayForm = z.infer<typeof paySchema>;

function PayableDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
  isPending,
  title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultValues: PayableForm;
  onSubmit: (v: PayableForm) => void;
  isPending: boolean;
  title: string;
}) {
  const { data: categories } = useListCategories();
  const form = useForm<PayableForm>({
    resolver: zodResolver(payableSchema),
    defaultValues,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) form.reset(defaultValues); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Preencha os dados da conta a pagar.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl><Input placeholder="Ex: Aluguel, Internet, Salário" {...field} /></FormControl>
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
                    <FormControl><Input type="number" step="0.01" placeholder="0,00" {...field} /></FormControl>
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
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function ContasPagar() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const now = new Date();
  const [period, setPeriod] = useState<PeriodValue | null>({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [statusFilter, setStatusFilter] = useState<"pendente" | "pago" | "">("pendente");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);

  const today = now.toISOString().split("T")[0];

  const periodParams = period ? periodToDates(period) : {};
  const queryParams = { ...periodParams, ...(statusFilter ? { status: statusFilter } : {}) };

  const { data: payables, isLoading } = useListPayables(queryParams);
  const createPayable = useCreatePayable();
  const updatePayable = useUpdatePayable();
  const deletePayable = useDeletePayable();
  const payPayable = usePayPayable();

  const payForm = useForm<PayForm>({
    resolver: zodResolver(paySchema),
    defaultValues: { paidAt: today },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListPayablesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
  }

  const createDefaults: PayableForm = {
    description: "",
    amount: 0,
    dueDate: today,
    categoryId: null,
  };

  function handleCreate(values: PayableForm) {
    createPayable.mutate(
      { data: { ...values, categoryId: values.categoryId ?? undefined } },
      {
        onSuccess: () => {
          invalidate();
          setIsCreateOpen(false);
          toast({ title: "Conta criada", description: "Conta a pagar adicionada com sucesso." });
        },
        onError: () => toast({ title: "Erro", description: "Não foi possível criar a conta.", variant: "destructive" }),
      }
    );
  }

  function handleEdit(id: number, values: PayableForm) {
    updatePayable.mutate(
      { id, data: { ...values, categoryId: values.categoryId ?? undefined } },
      {
        onSuccess: () => {
          invalidate();
          setEditingId(null);
          toast({ title: "Conta atualizada" });
        },
        onError: () => toast({ title: "Erro", variant: "destructive" }),
      }
    );
  }

  function handleDelete(id: number) {
    deletePayable.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Conta excluída" });
        },
        onError: () => toast({ title: "Erro", description: "Não é possível excluir contas já pagas.", variant: "destructive" }),
      }
    );
  }

  function openPay(id: number) {
    payForm.reset({ paidAt: today });
    setPayingId(id);
  }

  function handlePay(values: PayForm) {
    if (!payingId) return;
    payPayable.mutate(
      { id: payingId, data: { paidAt: values.paidAt } },
      {
        onSuccess: () => {
          invalidate();
          setPayingId(null);
          toast({
            title: "Pagamento registrado",
            description: "Despesa lançada automaticamente em Despesas.",
          });
        },
        onError: () => toast({ title: "Erro", description: "Não foi possível registrar o pagamento.", variant: "destructive" }),
      }
    );
  }

  const payingBill = payables?.find((p) => p.id === payingId);

  const totalPendente = payables?.filter(p => p.status === "pendente").reduce((s, p) => s + p.amount, 0) ?? 0;
  const totalPago = payables?.filter(p => p.status === "pago").reduce((s, p) => s + p.amount, 0) ?? 0;
  const countPendente = payables?.filter(p => p.status === "pendente").length ?? 0;


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contas a Pagar</h1>
          <p className="text-muted-foreground">Cadastre contas e pague com um clique — lançamento automático em Despesas</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova Conta
        </Button>
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
              {s === "" ? "Todos" : s === "pendente" ? "Pendente" : "Pago"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Pagar (Pendente)</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-32" /> : (
              <>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalPendente)}</p>
                <p className="text-xs text-muted-foreground mt-1">{countPendente} conta{countPendente !== 1 ? "s" : ""}</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Já Pago</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Categorias</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-16" /> : (
              <>
                <p className="text-2xl font-bold">
                  {new Set(payables?.filter(p => p.status === "pendente").map(p => p.categoryName || "Geral")).size}
                </p>
                <p className="text-xs text-muted-foreground mt-1">categorias pendentes</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create dialog */}
      <PayableDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        defaultValues={createDefaults}
        onSubmit={handleCreate}
        isPending={createPayable.isPending}
        title="Nova Conta a Pagar"
      />

      {/* Pay dialog */}
      <Dialog open={!!payingId} onOpenChange={(o) => { if (!o) setPayingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              {payingBill
                ? `${payingBill.description} — ${formatCurrency(payingBill.amount)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Uma despesa será criada automaticamente em <strong>Despesas</strong>.
          </p>
          <Form {...payForm}>
            <form onSubmit={payForm.handleSubmit(handlePay)} className="space-y-4">
              <FormField
                control={payForm.control}
                name="paidAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do Pagamento</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setPayingId(null)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={payPayable.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                >
                  <Banknote className="h-4 w-4" />
                  {payPayable.isPending ? "Pagando..." : "Confirmar Pagamento"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div>
        <div className="min-w-0">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[140px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : !payables?.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Clock className="h-8 w-8 opacity-30" />
                          <span>Nenhuma conta encontrada. Clique em "Nova Conta" para começar.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    (Array.isArray(payables) ? payables : []).map((payable) => {
                      const isOverdue = payable.status === "pendente" && payable.dueDate < today;
                      const editDefaults: PayableForm = {
                        description: payable.description,
                        amount: payable.amount,
                        dueDate: payable.dueDate,
                        categoryId: payable.categoryId ?? null,
                      };
                      return (
                        <TableRow
                          key={payable.id}
                          className={isOverdue ? "bg-red-50/50 dark:bg-red-950/10" : ""}
                        >
                          <TableCell className={isOverdue ? "font-medium text-red-600 dark:text-red-400" : ""}>
                            {formatDate(payable.dueDate)}
                          </TableCell>
                          <TableCell className="font-medium">{payable.description}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{payable.categoryName || "Geral"}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600 dark:text-red-500">
                            {formatCurrency(payable.amount)}
                          </TableCell>
                          <TableCell>
                            {payable.status === "pago" ? (
                              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                Pago {payable.paidAt ? `em ${formatDate(payable.paidAt)}` : ""}
                              </Badge>
                            ) : isOverdue ? (
                              <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                Atrasado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {payable.status === "pendente" && (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white gap-1 h-7 px-2 text-xs"
                                  onClick={() => openPay(payable.id)}
                                >
                                  <Banknote className="h-3.5 w-3.5" />
                                  Pagar
                                </Button>
                              )}
                              {payable.status === "pendente" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Editar"
                                  onClick={() => setEditingId(payable.id)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {payable.status === "pendente" && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        "{payable.description}" será excluída permanentemente.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(payable.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                            {editingId === payable.id && (
                              <PayableDialog
                                open
                                onOpenChange={(o) => { if (!o) setEditingId(null); }}
                                defaultValues={editDefaults}
                                onSubmit={(v) => handleEdit(payable.id, v)}
                                isPending={updatePayable.isPending}
                                title="Editar Conta a Pagar"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
                {!isLoading && !!payables?.length && (
                  <TableFooter>
                    <TableRow className="font-semibold border-t-2">
                      <TableCell colSpan={3} className="text-right text-muted-foreground">Total Pendente</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400 text-base">
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
      </div>
    </div>
  );
}
