import { useEffect, useState } from "react";
import { 
  useListClients, 
  useCreateClient, 
  useUpdateClient,
  useDeleteClient,
  getListClientsQueryKey,
  getListBillingsQueryKey,
  ClientInput
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Search, Pencil, Eye, UserPlus } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

function buildPickerDate(dueDay: number) {
  const safeDay = Math.max(1, Math.min(dueDay, 31));
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  if (safeDay <= daysInCurrentMonth) {
    return new Date(currentYear, currentMonth, safeDay);
  }

  return new Date(currentYear, 0, safeDay);
}

function parsePickerDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const clientSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  document: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal('')),
  address: z.string().optional(),
  monthlyFee: z.coerce.number().min(0, "Valor não pode ser negativo"),
  dueDate: z.date({ required_error: "Selecione a data de vencimento" }),
  status: z.enum(["ativo", "inativo"]),
});

type ClientForm = z.infer<typeof clientSchema>;

function toClientInput(values: ClientForm): ClientInput {
  const { dueDate, ...rest } = values;
  return {
    ...rest,
    dueDate: format(dueDate, "yyyy-MM-dd"),
    dueDay: dueDate.getDate(),
  };
}

function ClientDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
  isPending,
  title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultValues: ClientForm;
  onSubmit: (v: ClientForm) => void;
  isPending: boolean;
  title: string;
}) {
  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) form.reset(defaultValues); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Preencha os dados do cliente.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome / Razão Social</FormLabel>
                  <FormControl><Input placeholder="Ex: Empresa Silva Ltda" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF / CNPJ</FormLabel>
                    <FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl><Input type="email" placeholder="contato@empresa.com.br" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
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

export default function Clientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: clients, isLoading } = useListClients();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const filteredClients = (Array.isArray(clients) ? clients : []).filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.document?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createDefaults: ClientForm = {
    name: "",
    document: "",
    phone: "",
    email: "",
    address: "",
    monthlyFee: 0,
    dueDate: buildPickerDate(5),
    status: "ativo",
  };

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
  }

  function handleCreate(values: ClientForm) {
    createClient.mutate(
      { data: toClientInput(values) },
      {
        onSuccess: () => {
          invalidate();
          queryClient.invalidateQueries({ queryKey: getListBillingsQueryKey() });
          setIsCreateOpen(false);
          toast({
            title: "Cliente criado",
            description: "O cliente foi cadastrado com sucesso.",
          });
        },
        onError: () => toast({ title: "Erro", description: "Não foi possível criar o cliente.", variant: "destructive" }),
      }
    );
  }

  function handleEdit(id: number, values: ClientForm) {
    updateClient.mutate(
      { id, data: toClientInput(values) },
      {
        onSuccess: () => {
          invalidate();
          queryClient.invalidateQueries({ queryKey: getListBillingsQueryKey() });
          setEditingId(null);
          toast({ title: "Cliente atualizado" });
        },
        onError: () => toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" }),
      }
    );
  }

  function handleDelete(id: number) {
    deleteClient.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Cliente excluído" });
        },
        onError: () => toast({ title: "Erro", description: "Não foi possível excluir o cliente.", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gerencie os clientes cadastrados</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      <ClientDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        defaultValues={createDefaults}
        onSubmit={handleCreate}
        isPending={createClient.isPending}
        title="Novo Cliente"
      />

      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou documento..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredClients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients?.map((client) => {
                  const editDefaults: ClientForm = {
                    name: client.name,
                    document: client.document ?? "",
                    phone: client.phone ?? "",
                    email: client.email ?? "",
                    address: client.address ?? "",
                    monthlyFee: client.monthlyFee,
                    dueDate: client.dueDate ? parsePickerDate(client.dueDate) : buildPickerDate(client.dueDay),
                    status: client.status as "ativo" | "inativo",
                  };
                  return (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        <Link href={`/clientes/${client.id}`} className="hover:underline">
                          {client.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{client.document || '-'}</TableCell>
                      <TableCell>{client.dueDate ? formatDate(client.dueDate) : `Dia ${client.dueDay}`}</TableCell>
                      <TableCell>
                        <Badge
                          variant={client.status === 'ativo' ? "default" : "secondary"}
                          className={client.status === 'ativo' ? "bg-green-600 hover:bg-green-700" : ""}
                        >
                          {client.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/clientes/${client.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Editar"
                            onClick={() => setEditingId(client.id)}
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
                                <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir "{client.name}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(client.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        {editingId === client.id && (
                          <ClientDialog
                            open
                            onOpenChange={(o) => { if (!o) setEditingId(null); }}
                            defaultValues={editDefaults}
                            onSubmit={(v) => handleEdit(client.id, v)}
                            isPending={updateClient.isPending}
                            title="Editar Cliente"
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
