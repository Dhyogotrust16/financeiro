import { FormEvent, useMemo, useState } from "react";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgePercent, Handshake, Mail, Pencil, PieChart, Plus, Save, Trash2, UserRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";

interface Partner {
  id: string;
  name: string;
  email: string;
  percentage: number;
}

const STORAGE_KEY = "financeiro-partners";
const CHART_COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

function readPartners(): Partner[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partner[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePartners(partners: Partner[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(partners));
}

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(value, 100));
}

export default function Socio() {
  const { toast } = useToast();
  const date = new Date();
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1;
  const { data: summary, isLoading } = useGetDashboardSummary(currentYear, currentMonth);

  const [partners, setPartners] = useState<Partner[]>(() => readPartners());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [percentage, setPercentage] = useState("");

  const netProfit = Number(summary?.balance ?? 0);
  const totalPercentage = partners.reduce((sum, partner) => sum + partner.percentage, 0);
  const distributedAmount = partners.reduce((sum, partner) => sum + netProfit * (partner.percentage / 100), 0);
  const remainingPercentage = Math.max(0, 100 - totalPercentage);
  const remainingAmount = netProfit - distributedAmount;

  const partnerRows = useMemo(
    () =>
      partners.map((partner) => ({
        ...partner,
        amount: netProfit * (partner.percentage / 100),
      })),
    [netProfit, partners],
  );

  const chartData = useMemo(
    () =>
      partnerRows.map((partner) => ({
        name: partner.name,
        value: partner.amount,
        percentage: partner.percentage,
      })),
    [partnerRows],
  );

  function resetForm() {
    setEditingId(null);
    setName("");
    setEmail("");
    setPercentage("");
  }

  function persist(nextPartners: Partner[]) {
    setPartners(nextPartners);
    savePartners(nextPartners);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const parsedPercentage = clampPercentage(Number(percentage.replace(",", ".")));

    if (!trimmedName) {
      toast({ title: "Informe o nome do sócio", variant: "destructive" });
      return;
    }

    if (parsedPercentage <= 0) {
      toast({ title: "Informe uma porcentagem maior que zero", variant: "destructive" });
      return;
    }

    const percentageWithoutCurrent = partners
      .filter((partner) => partner.id !== editingId)
      .reduce((sum, partner) => sum + partner.percentage, 0);

    if (percentageWithoutCurrent + parsedPercentage > 100) {
      toast({
        title: "Percentual acima de 100%",
        description: "A soma dos percentuais dos sócios não pode ultrapassar 100%.",
        variant: "destructive",
      });
      return;
    }

    const nextPartners = editingId
      ? partners.map((partner) =>
          partner.id === editingId
            ? { ...partner, name: trimmedName, email: trimmedEmail, percentage: parsedPercentage }
            : partner,
        )
      : [
          ...partners,
          {
            id: crypto.randomUUID(),
            name: trimmedName,
            email: trimmedEmail,
            percentage: parsedPercentage,
          },
        ];

    persist(nextPartners);
    resetForm();
    toast({ title: editingId ? "Sócio atualizado" : "Sócio cadastrado" });
  }

  function handleEdit(partner: Partner) {
    setEditingId(partner.id);
    setName(partner.name);
    setEmail(partner.email);
    setPercentage(String(partner.percentage).replace(".", ","));
  }

  function handleDelete(partnerId: string) {
    persist(partners.filter((partner) => partner.id !== partnerId));
    if (editingId === partnerId) resetForm();
    toast({ title: "Sócio removido" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sócio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre sócios e acompanhe a participação de cada um no lucro líquido mensal.
          </p>
        </div>
        <div className="rounded-md border bg-background px-4 py-3 text-sm">
          <span className="text-muted-foreground">Período atual</span>
          <strong className="ml-2">{String(currentMonth).padStart(2, "0")}/{currentYear}</strong>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro líquido</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : formatCurrency(netProfit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sócios cadastrados</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partners.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distribuído</CardTitle>
            <BadgePercent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPercentage.toFixed(2).replace(".", ",")}%</div>
            <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(distributedAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo não distribuído</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{remainingPercentage.toFixed(2).replace(".", ",")}%</div>
            <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(remainingAmount)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" />
              {editingId ? "Editar sócio" : "Novo sócio"}
            </CardTitle>
            <CardDescription>A participação é calculada sobre o lucro líquido do mês atual.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="partner-name">Nome</Label>
                <Input id="partner-name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-email">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="partner-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-percentage">Porcentagem do lucro líquido</Label>
                <div className="relative">
                  <BadgePercent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="partner-percentage"
                    inputMode="decimal"
                    value={percentage}
                    onChange={(event) => setPercentage(event.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="flex-1">
                  {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {editingId ? "Salvar sócio" : "Cadastrar sócio"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dashboard dos sócios</CardTitle>
            <CardDescription>Distribuição secundária, independente do dashboard principal.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-h-[320px]">
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(value) => `R$${Number(value) / 1000}k`}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => `Sócio: ${label}`}
                        contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}
                      />
                      <Bar dataKey="value" name="Participação" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[320px] items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
                    Cadastre um sócio para visualizar a distribuição.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {partnerRows.length ? (
                  partnerRows.map((partner, index) => (
                    <div key={partner.id} className="rounded-md border p-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{partner.name}</p>
                          <p className="text-xs text-muted-foreground">{partner.percentage.toFixed(2).replace(".", ",")}% do lucro</p>
                        </div>
                      </div>
                      <p className="mt-3 text-lg font-semibold">{formatCurrency(partner.amount)}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    Nenhuma participação definida.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de sócios</CardTitle>
          <CardDescription>Percentuais cadastrados para o lucro líquido mensal.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sócio</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="text-right">Percentual</TableHead>
                  <TableHead className="text-right">Valor estimado</TableHead>
                  <TableHead className="w-[110px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerRows.length ? (
                  partnerRows.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell className="font-medium">{partner.name}</TableCell>
                      <TableCell className="text-muted-foreground">{partner.email || "-"}</TableCell>
                      <TableCell className="text-right">{partner.percentage.toFixed(2).replace(".", ",")}%</TableCell>
                      <TableCell className="text-right">{formatCurrency(partner.amount)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleEdit(partner)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(partner.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Nenhum sócio cadastrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
