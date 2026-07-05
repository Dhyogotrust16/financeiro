import { FormEvent, useMemo, useState } from "react";
import {
  getGetDashboardCashflowQueryKey,
  getGetDashboardSummaryQueryKey,
  getListRevenuesQueryKey,
  useCreateRevenue,
  useListClients,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Banknote, CalendarDays, CheckCircle2, Clock, Landmark, Plus, ReceiptText, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { applyDashboardRevenueSnapshot } from "@/lib/dashboard-cache";
import { formatCurrency, formatDate } from "@/lib/format";

interface HonorarioPayment {
  id: string;
  amount: number;
  paidAt: string;
  paymentMethod: string;
  notes: string;
}

interface Honorario {
  id: string;
  clientId: number;
  clientName: string;
  description: string;
  competence: string;
  dueDate: string;
  amount: number;
  payments: HonorarioPayment[];
  createdAt: string;
}

type StatusFilter = "todos" | "pendente" | "parcial" | "recebido";

const STORAGE_KEY = "financeiro-honorarios";
const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
];

function makeId() {
  return crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function currentCompetence() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function dateParts(dateString: string) {
  const [year, month] = dateString.split("-").map(Number);
  const now = new Date();

  return {
    year: Number.isFinite(year) ? year : now.getFullYear(),
    month: Number.isFinite(month) ? month : now.getMonth() + 1,
  };
}

function readHonorarios(): Honorario[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Honorario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHonorarios(items: Honorario[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function paidTotal(honorario: Honorario) {
  return honorario.payments.reduce((sum, payment) => sum + payment.amount, 0);
}

function honorarioStatus(honorario: Honorario) {
  const paid = paidTotal(honorario);
  if (paid <= 0) return "pendente";
  if (paid >= honorario.amount) return "recebido";
  return "parcial";
}

function statusLabel(status: string) {
  if (status === "recebido") return "Recebido";
  if (status === "parcial") return "Parcial";
  return "Pendente";
}

function statusClass(status: string) {
  if (status === "recebido") return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400";
  if (status === "parcial") return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
  return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400";
}

export default function Honorarios() {
  const { data: clients } = useListClients();
  const createRevenue = useCreateRevenue();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [honorarios, setHonorarios] = useState<Honorario[]>(() => readHonorarios());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [search, setSearch] = useState("");

  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [description, setDescription] = useState("");
  const [competence, setCompetence] = useState(currentCompetence());
  const [dueDate, setDueDate] = useState(today());
  const [amount, setAmount] = useState("");

  const [payAmount, setPayAmount] = useState("");
  const [paidAt, setPaidAt] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [payNotes, setPayNotes] = useState("");

  const selectedHonorario = honorarios.find((item) => item.id === payingId) ?? null;
  const selectedBalance = selectedHonorario ? Math.max(0, selectedHonorario.amount - paidTotal(selectedHonorario)) : 0;
  const selectedClientForForm = clients?.find((client) => client.id === Number(clientId));
  const filteredClients = useMemo(() => {
    const termRaw = clientSearch.trim();
    const term = termRaw.toLowerCase();
    if (!term) return [];

    function initialsFor(name: string) {
      return name
        .split(/\s+/)
        .map((w) => w[0] ?? "")
        .join("")
        .toLowerCase();
    }

    return (clients ?? [])
      .filter((client) => {
        const initials = initialsFor(client.name);
        // match when typed value equals the initials prefix, or when user types same letters ignoring spaces
        const compact = termRaw.replace(/\s+/g, "").toLowerCase();
        return initials.startsWith(compact);
      })
      .slice(0, 6);
  }, [clientSearch, clients]);

  const enriched = useMemo(
    () =>
      honorarios
        .map((item) => {
          const paid = paidTotal(item);
          return {
            ...item,
            paid,
            balance: Math.max(0, item.amount - paid),
            status: honorarioStatus(item),
          };
        })
        .filter((item) => {
          const matchesStatus = statusFilter === "todos" || item.status === statusFilter;
          const term = search.trim().toLowerCase();
          const matchesSearch =
            !term ||
            item.clientName.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term) ||
            item.competence.includes(term);
          return matchesStatus && matchesSearch;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [honorarios, search, statusFilter],
  );

  const totalHonorarios = honorarios.reduce((sum, item) => sum + item.amount, 0);
  const totalRecebido = honorarios.reduce((sum, item) => sum + paidTotal(item), 0);
  const totalPendente = Math.max(0, totalHonorarios - totalRecebido);
  const partialCount = honorarios.filter((item) => honorarioStatus(item) === "parcial").length;

  function persist(next: Honorario[]) {
    setHonorarios(next);
    saveHonorarios(next);
  }

  function resetCreateForm() {
    setClientId("");
    setClientSearch("");
    setDescription("");
    setCompetence(currentCompetence());
    setDueDate(today());
    setAmount("");
  }

  function openPayment(id: string) {
    const item = honorarios.find((h) => h.id === id);
    if (!item) return;
    const balance = Math.max(0, item.amount - paidTotal(item));
    setPayingId(id);
    setPayAmount(balance ? String(balance) : "");
    setPaidAt(today());
    setPaymentMethod("pix");
    setPayNotes("");
  }

  function refreshFinancials(receivedAt: string, receivedAmount: number) {
    const { year, month } = dateParts(receivedAt);
    const revenuesKey = getListRevenuesQueryKey();
    const summaryKey = getGetDashboardSummaryQueryKey(year, month);
    const cashflowKey = getGetDashboardCashflowQueryKey();

    applyDashboardRevenueSnapshot(receivedAt, receivedAmount);

    queryClient.setQueryData(summaryKey, (current: any) => {
      if (!current) return current;

      return {
        ...current,
        totalRevenue: Number(current.totalRevenue ?? 0) + receivedAmount,
        balance: Number(current.balance ?? 0) + receivedAmount,
      };
    });

    queryClient.setQueryData(cashflowKey, (current: any) => {
      if (!Array.isArray(current)) return current;

      return current.map((entry) => {
        if (Number(entry.year) !== year || Number(entry.month) !== month) return entry;

        return {
          ...entry,
          revenue: Number(entry.revenue ?? 0) + receivedAmount,
          balance: Number(entry.balance ?? 0) + receivedAmount,
        };
      });
    });

    queryClient.invalidateQueries({ queryKey: revenuesKey, exact: false });
    queryClient.invalidateQueries({ queryKey: summaryKey });
    queryClient.invalidateQueries({ queryKey: cashflowKey });

    void queryClient.refetchQueries({ queryKey: revenuesKey, exact: false, type: "all" });
    void queryClient.refetchQueries({ queryKey: summaryKey, type: "all" });
    void queryClient.refetchQueries({ queryKey: cashflowKey, type: "all" });
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedClient = clients?.find((client) => client.id === Number(clientId));
    const parsedAmount = Number(amount.replace(",", "."));

    if (!selectedClient) {
      toast({ title: "Selecione um cliente", variant: "destructive" });
      return;
    }

    if (!description.trim()) {
      toast({ title: "Informe a descrição do honorário", variant: "destructive" });
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" });
      return;
    }

    persist([
      ...honorarios,
      {
        id: makeId(),
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        description: description.trim(),
        competence,
        dueDate,
        amount: parsedAmount,
        payments: [],
        createdAt: new Date().toISOString(),
      },
    ]);
    setIsCreateOpen(false);
    resetCreateForm();
    toast({ title: "Honorário cadastrado" });
  }

  function handlePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedHonorario) return;

    const parsedAmount = Number(payAmount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Informe um valor de baixa válido", variant: "destructive" });
      return;
    }

    if (parsedAmount > selectedBalance) {
      toast({
        title: "Valor acima do saldo",
        description: `O saldo em aberto é ${formatCurrency(selectedBalance)}.`,
        variant: "destructive",
      });
      return;
    }

    const payment: HonorarioPayment = {
      id: makeId(),
      amount: parsedAmount,
      paidAt,
      paymentMethod,
      notes: payNotes.trim(),
    };

    const next = honorarios.map((item) =>
      item.id === selectedHonorario.id ? { ...item, payments: [...item.payments, payment] } : item,
    );

    createRevenue.mutate(
      {
        data: {
          date: paidAt,
          description: `Baixa de honorário - ${selectedHonorario.clientName} - ${selectedHonorario.competence}`,
          amount: parsedAmount,
          clientId: selectedHonorario.clientId,
          paymentMethod,
          status: "recebido",
        },
      },
      {
        onSuccess: () => {
          persist(next);
          refreshFinancials(paidAt, parsedAmount);
          setPayingId(null);
          toast({ title: "Baixa registrada", description: "A receita recebida também foi lançada." });
        },
        onError: () => {
          toast({
            title: "Erro ao registrar baixa",
            description: "Não foi possível lançar a receita do honorário.",
            variant: "destructive",
          });
        },
      },
    );
  }

  function handleDelete(id: string) {
    const item = honorarios.find((h) => h.id === id);
    if (item && item.payments.length > 0) {
      toast({
        title: "Honorário com baixa",
        description: "Honorários com pagamentos registrados não podem ser excluídos por aqui.",
        variant: "destructive",
      });
      return;
    }
    persist(honorarios.filter((item) => item.id !== id));
    toast({ title: "Honorário removido" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Honorários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre honorários por cliente e registre baixas totais ou parciais.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo honorário
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Honorários cadastrados</CardTitle>
            <ReceiptText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalHonorarios)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebido</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalRecebido)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em aberto</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalPendente)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Baixas parciais</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partialCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por cliente, descrição ou competência" className="pl-9" />
        </div>
        <div className="grid grid-cols-4 overflow-hidden rounded-md border bg-background text-sm sm:flex">
          {(["todos", "pendente", "parcial", "recebido"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={[
                "px-3 py-2 font-medium transition-colors sm:min-w-24",
                statusFilter === status ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              ].join(" ")}
            >
              {status === "todos" ? "Todos" : statusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-muted/20 px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Carteira de honorarios</CardTitle>
            <span className="text-sm text-muted-foreground">
              {enriched.length} registro{enriched.length === 1 ? "" : "s"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {enriched.length ? (
            <div className="divide-y">
              {enriched.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/25 md:grid-cols-[minmax(120px,1fr)_124px_minmax(250px,270px)_72px] md:items-center 2xl:grid-cols-[minmax(180px,1.2fr)_150px_minmax(360px,420px)_116px] 2xl:gap-4 2xl:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{item.clientName}</p>
                      <Badge variant="outline" className={statusClass(item.status)}>
                        {statusLabel(item.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{item.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm md:block md:space-y-1">
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-foreground">Competencia</p>
                      <p className="font-medium">{item.competence}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-foreground">Vencimento</p>
                      <p className="font-medium">{formatDate(item.dueDate)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-md border bg-background p-2.5 text-sm 2xl:gap-3 2xl:p-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p className="truncate font-semibold" title={formatCurrency(item.amount)}>{formatCurrency(item.amount)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Recebido</p>
                      <p className="truncate font-semibold text-green-600 dark:text-green-400" title={formatCurrency(item.paid)}>{formatCurrency(item.paid)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Pendente</p>
                      <p className="truncate font-semibold text-amber-600 dark:text-amber-400" title={formatCurrency(item.balance)}>{formatCurrency(item.balance)}</p>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center justify-end gap-1 2xl:gap-2">
                    {item.status !== "recebido" && (
                      <Button size="sm" className="h-8 px-2 2xl:px-3" onClick={() => openPayment(item.id)}>
                        <Banknote className="h-4 w-4" />
                        <span className="hidden 2xl:inline">Baixar</span>
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
              Nenhum honorario encontrado.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="hidden">
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <Table className="table-fixed [&_td]:align-top [&_th:nth-child(2)]:hidden [&_td:nth-child(2)]:hidden [&_th:nth-child(3)]:hidden [&_td:nth-child(3)]:hidden [&_th:nth-child(4)]:hidden [&_td:nth-child(4)]:hidden [&_th:nth-child(6)]:hidden [&_td:nth-child(6)]:hidden [&_th:nth-child(7)]:hidden [&_td:nth-child(7)]:hidden [&_th:nth-child(8)]:hidden [&_td:nth-child(8)]:hidden md:[&_th:nth-child(2)]:table-cell md:[&_td:nth-child(2)]:table-cell md:[&_th:nth-child(8)]:table-cell md:[&_td:nth-child(8)]:table-cell lg:[&_th:nth-child(3)]:table-cell lg:[&_td:nth-child(3)]:table-cell lg:[&_th:nth-child(4)]:table-cell lg:[&_td:nth-child(4)]:table-cell xl:[&_th:nth-child(6)]:table-cell xl:[&_td:nth-child(6)]:table-cell xl:[&_th:nth-child(7)]:table-cell xl:[&_td:nth-child(7)]:table-cell">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[34%]">HonorÃ¡rio</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.length ? (
                  enriched.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="min-w-0">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.clientName}</p>
                          <p className="truncate text-sm text-muted-foreground md:hidden">{item.description}</p>
                          <div className="mt-2 flex flex-wrap gap-1 lg:hidden">
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {item.competence}
                            </span>
                            <Badge variant="outline" className={`md:hidden ${statusClass(item.status)}`}>
                              {statusLabel(item.status)}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="truncate">{item.description}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.competence}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(item.dueDate)}</TableCell>
                      <TableCell className="text-right">
                        <div className="space-y-1 whitespace-nowrap text-sm">
                          <p className="font-semibold">{formatCurrency(item.amount)}</p>
                          <p className="text-green-600 dark:text-green-400 xl:hidden">Rec. {formatCurrency(item.paid)}</p>
                          <p className="text-amber-600 dark:text-amber-400 xl:hidden">Saldo {formatCurrency(item.balance)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-green-600 dark:text-green-400">{formatCurrency(item.paid)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-amber-600 dark:text-amber-400">{formatCurrency(item.balance)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass(item.status)}>
                          {statusLabel(item.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {item.status !== "recebido" && (
                            <Button size="sm" className="h-8 px-2 sm:px-3" onClick={() => openPayment(item.id)}>
                              <Banknote className="h-4 w-4" />
                              <span className="hidden sm:inline">Baixar</span>
                            </Button>
                          )}
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                      Nenhum honorário encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) resetCreateForm(); setIsCreateOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo honorário</DialogTitle>
            <DialogDescription>Vincule o honorário a um cliente cadastrado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="honorario-client-search">Cliente</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="honorario-client-search"
                    value={clientSearch}
                    onChange={(event) => {
                      setClientSearch(event.target.value);
                      setClientId("");
                    }}
                    placeholder="Buscar cliente"
                    className="pl-9"
                  />
                </div>
                {selectedClientForForm ? (
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <span className="font-medium">{selectedClientForForm.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        setClientId("");
                        setClientSearch("");
                      }}
                    >
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto rounded-md border bg-background p-1">
                    {filteredClients.length ? (
                      filteredClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setClientId(String(client.id));
                            setClientSearch(client.name);
                          }}
                        >
                          {client.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="honorario-description">Descrição</Label>
              <Input id="honorario-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex: Honorário mensal" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="honorario-competence">Competência</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="honorario-competence" type="month" value={competence} onChange={(event) => setCompetence(event.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="honorario-due-date">Vencimento</Label>
                <Input id="honorario-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="honorario-amount">Valor</Label>
                <Input id="honorario-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Cadastrar honorário</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payingId} onOpenChange={(open) => { if (!open) setPayingId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Baixa de honorário</DialogTitle>
            <DialogDescription>
              {selectedHonorario ? `${selectedHonorario.clientName} - saldo ${formatCurrency(selectedBalance)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pay-amount">Valor da baixa</Label>
                <Input id="pay-amount" inputMode="decimal" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid-at">Data</Label>
                <Input id="paid-at" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-notes">Observação</Label>
              <Input id="pay-notes" value={payNotes} onChange={(event) => setPayNotes(event.target.value)} placeholder="Opcional" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPayingId(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createRevenue.isPending}>
                <Landmark className="h-4 w-4" />
                {createRevenue.isPending ? "Registrando..." : "Registrar baixa"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
