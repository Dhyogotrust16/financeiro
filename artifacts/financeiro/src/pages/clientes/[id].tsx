import { useRoute } from "wouter";
import { 
  useGetClient,
  useGetClientMonthlyClose,
  useListBillings
} from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { User, Phone, Mail, MapPin, FileText, Calendar, Building, DollarSign } from "lucide-react";

export default function ClienteDetail() {
  const [, params] = useRoute("/clientes/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  
  const date = new Date();
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1;

  const { data: client, isLoading: isClientLoading } = useGetClient(id, { query: { enabled: !!id, queryKey: [`/api/clients/${id}`] } });
  const { data: monthlyClose, isLoading: isCloseLoading } = useGetClientMonthlyClose(id, currentYear, currentMonth, { query: { enabled: !!id, queryKey: [`/api/clients/${id}/monthly-close/${currentYear}/${currentMonth}`] } });
  const { data: billings, isLoading: isBillingsLoading } = useListBillings({ clientId: id }, { query: { enabled: !!id, queryKey: [`/api/billings`, { clientId: id }] } });

  if (isClientLoading) {
    return <div className="p-8"><Skeleton className="h-10 w-1/3 mb-6" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!client) {
    return <div className="p-8 text-center">Cliente não encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-muted-foreground">
            <Badge variant={client.status === 'ativo' ? "default" : "secondary"} className={client.status === 'ativo' ? "bg-green-600" : ""}>
              {client.status === 'ativo' ? 'Ativo' : 'Inativo'}
            </Badge>
            <span>• Cliente desde {formatDate(client.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Documento</p>
                <p className="text-sm text-muted-foreground">{client.document || 'Não informado'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">E-mail</p>
                <p className="text-sm text-muted-foreground">{client.email || 'Não informado'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Telefone</p>
                <p className="text-sm text-muted-foreground">{client.phone || 'Não informado'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Endereço</p>
                <p className="text-sm text-muted-foreground">{client.address || 'Não informado'}</p>
              </div>
            </div>
            <div className="pt-4 border-t mt-4">
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Honorário Mensal</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(client.monthlyFee)}</p>
                  <p className="text-xs text-muted-foreground">Vencimento: Dia {client.dueDay}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Visão Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="close">
              <TabsList className="mb-4">
                <TabsTrigger value="close">Fechamento Atual</TabsTrigger>
                <TabsTrigger value="history">Histórico de Cobranças</TabsTrigger>
              </TabsList>
              
              <TabsContent value="close" className="space-y-4">
                {isCloseLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <div>
                    <h3 className="font-semibold mb-2">Fechamento de {currentMonth}/{currentYear}</h3>
                    <div className="bg-muted/30 rounded-lg p-4 mb-4">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Honorário Mensal</span>
                        <span className="font-medium">{formatCurrency(monthlyClose?.monthlyFee)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Total de Despesas Repassadas</span>
                        <span className="font-medium">{formatCurrency(monthlyClose?.totalExpenses)}</span>
                      </div>
                      <div className="flex justify-between py-2 pt-4">
                        <span className="font-bold">Total a Cobrar</span>
                        <span className="font-bold text-lg text-primary">{formatCurrency(monthlyClose?.totalCharge)}</span>
                      </div>
                    </div>

                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Despesas a Repassar</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyClose?.expenses && monthlyClose.expenses.length > 0 ? (
                          monthlyClose.expenses.map((expense) => (
                            <TableRow key={expense.id}>
                              <TableCell>{formatDate(expense.date)}</TableCell>
                              <TableCell>{expense.description}</TableCell>
                              <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-4">Nenhuma despesa para repassar este mês</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="history">
                {isBillingsLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês/Ano</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {billings && billings.length > 0 ? (
                        billings.map((billing) => (
                          <TableRow key={billing.id}>
                            <TableCell>{billing.month}/{billing.year}</TableCell>
                            <TableCell>{formatDate(billing.dueDate)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(billing.totalAmount)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                billing.status === 'pago' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                                billing.status === 'atrasado' ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                                "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                              }>
                                {billing.status.toUpperCase()}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-4">Nenhuma cobrança registrada</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}