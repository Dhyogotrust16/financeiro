import { useState } from "react";
import {
  useListExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useListClients,
  useListCategories,
  getListExpensesQueryKey,
} from "@workspace/api-client-react";
import { PeriodFilter, periodToDates, type PeriodValue } from "@/components/period-filter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  FormDescription,
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
import { Plus, Trash2, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const expenseSchema = z.object({
  date: z.string().min(1, "Data obrigatória"),
  description: z.string().min(2, "Descrição obrigatória"),
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  categoryId: z.coerce.number().optional().nullable(),
  clientId: z.coerce.number().optional().nullable(),
  passToClient: z.boolean(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

function ExpenseDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
  isPending,
  title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultValues: ExpenseForm;
  onSubmit: (v: ExpenseForm) => void;
  isPending: boolean;
  title: string;
}) {
  const { data: clients } = useListClients();
  const { data: categories } = useListCategories();
  const expenseCategories = categories?.filter((category) => category.type === "despesa") ?? [];

  const form = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues,
  });

  const passToClient = form.watch("passToClient");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) form.reset(defaultValues); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Preencha os dados da despesa.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl><Input placeholder="Ex: Certificado Digital" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {expenseCategories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="passToClient"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Repassar ao cliente</FormLabel>
                    <FormDescription>Essa despesa será incluída no fechamento mensal do cliente.</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {passToClient && (
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {clients?.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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

export default function Despesas() {
  const now = new Date();
  const [period, setPeriod] = useState<PeriodValue | null>({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const periodParams = period ? periodToDates(period) : {};
  const { data: expenses, isLoading } = useListExpenses(periodParams);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const sortedExpenses = (Array.isArray(expenses) ? expenses : []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const totalDespesas = sortedExpenses.reduce((s, e) => s + e.amount, 0);
  const totalRepasse = sortedExpenses.filter(e => e.passToClient).reduce((s, e) => s + e.amount, 0);

  const createDefaults: ExpenseForm = {
    date: today,
    description: "",
    amount: 0,
    categoryId: null,
    clientId: null,
    passToClient: false,
  };

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
  }

  function handleCreate(values: ExpenseForm) {
    createExpense.mutate(
      { data: { ...values, categoryId: values.categoryId ?? undefined, clientId: values.clientId ?? undefined } },
      {
        onSuccess: () => {
          invalidate();
          setIsCreateOpen(false);
          toast({ title: "Despesa criada", description: "Despesa adicionada com sucesso." });
        },
        onError: () => toast({ title: "Erro", description: "Não foi possível criar a despesa.", variant: "destructive" }),
      }
    );
  }

  function handleEdit(id: number, values: ExpenseForm) {
    updateExpense.mutate(
      { id, data: { ...values, categoryId: values.categoryId ?? undefined, clientId: values.clientId ?? undefined } },
      {
        onSuccess: () => {
          invalidate();
          setEditingId(null);
          toast({ title: "Despesa atualizada" });
        },
        onError: () => toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" }),
      }
    );
  }

  function handleDelete(id: number) {
    deleteExpense.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Despesa excluída" });
        },
        onError: () => toast({ title: "Erro", description: "Não é possível excluir despesas já faturadas.", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Despesas</h1>
          <p className="text-muted-foreground">Controle de saídas e despesas a repassar</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova Despesa
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        {!isLoading && !!sortedExpenses?.length && (
            <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              Total: <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(totalDespesas)}</span>
            </span>
            {totalRepasse > 0 && (
              <span className="text-muted-foreground">
                Repasse: <span className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(totalRepasse)}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <ExpenseDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        defaultValues={createDefaults}
        onSubmit={handleCreate}
        isPending={createExpense.isPending}
        title="Nova Despesa"
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Cliente/Repasse</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
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
              ) : !sortedExpenses?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma despesa encontrada. Clique em "Nova Despesa" para começar.
                  </TableCell>
                </TableRow>
              ) : (
                sortedExpenses.map((expense) => {
                  const editDefaults: ExpenseForm = {
                    date: expense.date,
                    description: expense.description,
                    amount: expense.amount,
                    categoryId: expense.categoryId ?? null,
                    clientId: expense.clientId ?? null,
                    passToClient: expense.passToClient,
                  };
                  return (
                    <TableRow key={expense.id}>
                      <TableCell>{formatDate(expense.date)}</TableCell>
                      <TableCell className="font-medium">{expense.description}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{expense.categoryName || 'Geral'}</Badge>
                      </TableCell>
                      <TableCell>
                        {expense.passToClient && expense.clientName ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{expense.clientName}</span>
                            <span className="text-xs text-muted-foreground">
                              {expense.billedInId ? "Já faturado" : "Aguardando fechamento"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600 dark:text-red-500">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Editar"
                            onClick={() => setEditingId(expense.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
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
                                <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{expense.description}" será excluída permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(expense.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        {editingId === expense.id && (
                          <ExpenseDialog
                            open
                            onOpenChange={(o) => { if (!o) setEditingId(null); }}
                            defaultValues={editDefaults}
                            onSubmit={(v) => handleEdit(expense.id, v)}
                            isPending={updateExpense.isPending}
                            title="Editar Despesa"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
