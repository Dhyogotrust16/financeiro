import { useState } from "react";
import {
  useListRevenues,
  useCreateRevenue,
  useUpdateRevenue,
  useDeleteRevenue,
  useListClients,
  getListRevenuesQueryKey,
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
  DialogTrigger,
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
import { Plus, Trash2, CheckCircle2, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const revenueSchema = z.object({
  date: z.string().min(1, "Data obrigatória"),
  description: z.string().min(2, "Descrição obrigatória"),
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  clientId: z.coerce.number().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  status: z.enum(["pendente", "recebido"]),
});

type RevenueForm = z.infer<typeof revenueSchema>;

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
];

function RevenueDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
  isPending,
  title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultValues: RevenueForm;
  onSubmit: (v: RevenueForm) => void;
  isPending: boolean;
  title: string;
}) {
  const { data: clients } = useListClients();
  const form = useForm<RevenueForm>({
    resolver: zodResolver(revenueSchema),
    defaultValues,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) form.reset(defaultValues); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Preencha os dados da receita.</DialogDescription>
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
                  <FormControl><Input placeholder="Ex: Honorário Janeiro 2026" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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
                        <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
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
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de Pagamento</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="recebido">Recebido</SelectItem>
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

export default function Receitas() {
  const now = new Date();
  const [period, setPeriod] = useState<PeriodValue | null>({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const periodParams = period ? periodToDates(period) : {};
  const { data: revenues, isLoading } = useListRevenues(periodParams);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createRevenue = useCreateRevenue();
  const updateRevenue = useUpdateRevenue();
  const deleteRevenue = useDeleteRevenue();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const sortedRevenues = (Array.isArray(revenues) ? revenues : []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const totalRecebido = sortedRevenues.filter(r => r.status === "recebido").reduce((s, r) => s + r.amount, 0);
  const totalPendente = sortedRevenues.filter(r => r.status === "pendente").reduce((s, r) => s + r.amount, 0);

  const createDefaults: RevenueForm = {
    date: today,
    description: "",
    amount: 0,
    clientId: null,
    paymentMethod: null,
    status: "pendente",
  };

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListRevenuesQueryKey() });
  }

  function handleCreate(values: RevenueForm) {
    createRevenue.mutate(
      { data: { ...values, clientId: values.clientId ?? undefined, paymentMethod: values.paymentMethod ?? undefined } },
      {
        onSuccess: () => {
          invalidate();
          setIsCreateOpen(false);
          toast({ title: "Receita criada", description: "Receita adicionada com sucesso." });
        },
        onError: () => toast({ title: "Erro", description: "Não foi possível criar a receita.", variant: "destructive" }),
      }
    );
  }

  function handleEdit(id: number, values: RevenueForm) {
    updateRevenue.mutate(
      { id, data: { ...values, clientId: values.clientId ?? undefined, paymentMethod: values.paymentMethod ?? undefined } },
      {
        onSuccess: () => {
          invalidate();
          setEditingId(null);
          toast({ title: "Receita atualizada" });
        },
        onError: () => toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" }),
      }
    );
  }

  function handleMarkReceived(id: number) {
    updateRevenue.mutate(
      { id, data: { status: "recebido" } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Marcado como recebido" });
        },
        onError: () => toast({ title: "Erro", variant: "destructive" }),
      }
    );
  }

  function handleDelete(id: number) {
    deleteRevenue.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Receita excluída" });
        },
        onError: () => toast({ title: "Erro", description: "Não foi possível excluir a receita.", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receitas</h1>
          <p className="text-muted-foreground">Gestão de todas as receitas recebidas e pendentes</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova Receita
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        {!isLoading && !!sortedRevenues?.length && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              Recebido: <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(totalRecebido)}</span>
            </span>
            <span className="text-muted-foreground">
              Pendente: <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(totalPendente)}</span>
            </span>
          </div>
        )}
      </div>

      <RevenueDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        defaultValues={createDefaults}
        onSubmit={handleCreate}
        isPending={createRevenue.isPending}
        title="Nova Receita"
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[580px]">
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Forma Pgto.</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !sortedRevenues?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma receita encontrada. Clique em "Nova Receita" para começar.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRevenues.map((revenue) => {
                  const editDefaults: RevenueForm = {
                    date: revenue.date,
                    description: revenue.description,
                    amount: revenue.amount,
                    clientId: revenue.clientId ?? null,
                    paymentMethod: revenue.paymentMethod ?? null,
                    status: revenue.status as "pendente" | "recebido",
                  };
                  return (
                    <TableRow key={revenue.id}>
                      <TableCell>{formatDate(revenue.date)}</TableCell>
                      <TableCell className="font-medium">{revenue.description}</TableCell>
                      <TableCell className="text-muted-foreground">{revenue.clientName || '-'}</TableCell>
                      <TableCell className="text-muted-foreground capitalize">{revenue.paymentMethod || '-'}</TableCell>
                      <TableCell className="text-right font-medium text-green-600 dark:text-green-500">
                        {formatCurrency(revenue.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={revenue.status === 'recebido'
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}
                        >
                          {revenue.status === 'recebido' ? 'Recebido' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {revenue.status === 'pendente' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Marcar como recebido"
                              onClick={() => handleMarkReceived(revenue.id)}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Editar"
                            onClick={() => setEditingId(revenue.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir receita?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{revenue.description}" será excluída permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => handleDelete(revenue.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                )}
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        {editingId === revenue.id && (
                          <RevenueDialog
                            open
                            onOpenChange={(o) => { if (!o) setEditingId(null); }}
                            defaultValues={editDefaults}
                            onSubmit={(v) => handleEdit(revenue.id, v)}
                            isPending={updateRevenue.isPending}
                            title="Editar Receita"
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
