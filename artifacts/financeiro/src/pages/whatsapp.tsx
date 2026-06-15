import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Wifi, WifiOff, RefreshCw, LogOut, Settings, QrCode, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "evo_config";
const DRAFT_KEY = "evo_config_draft";

interface EvoConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

type ConnectionState = "open" | "close" | "connecting" | null;

const configSchema = z.object({
  apiUrl: z.string().url("URL inválida").min(1, "Obrigatório"),
  apiKey: z.string().min(1, "Obrigatório"),
  instanceName: z.string().min(1, "Obrigatório").regex(/^[a-zA-Z0-9_-]+$/, "Apenas letras, números, _ e -"),
});

type ConfigForm = z.infer<typeof configSchema>;

// ---------------------------------------------------------------------------
// Evolution API helpers
// ---------------------------------------------------------------------------

function buildHeaders(apiKey: string) {
  return { "Content-Type": "application/json", apikey: apiKey };
}

async function evoFetch(config: EvoConfig, path: string, options: RequestInit = {}) {
  const base = config.apiUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...buildHeaders(config.apiKey), ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Evolution API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function createInstance(config: EvoConfig) {
  return evoFetch(config, `/instance/create`, {
    method: "POST",
    body: JSON.stringify({
      instanceName: config.instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    }),
  });
}

async function fetchQrCode(config: EvoConfig): Promise<string | null> {
  try {
    const data = await evoFetch(config, `/instance/connect/${config.instanceName}`);
    return data?.base64 ?? data?.qrcode?.base64 ?? null;
  } catch {
    return null;
  }
}

async function fetchConnectionState(config: EvoConfig): Promise<ConnectionState> {
  try {
    const data = await evoFetch(config, `/instance/connectionState/${config.instanceName}`);
    return data?.instance?.state ?? data?.state ?? null;
  } catch {
    return null;
  }
}

async function logoutInstance(config: EvoConfig) {
  return evoFetch(config, `/instance/logout/${config.instanceName}`, { method: "DELETE" });
}

async function deleteInstance(config: EvoConfig) {
  return evoFetch(config, `/instance/delete/${config.instanceName}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WhatsApp() {
  const { toast } = useToast();

  const [config, setConfig] = useState<EvoConfig | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [showConfig, setShowConfig] = useState(!config);
  const [connectionState, setConnectionState] = useState<ConnectionState>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [loadingState, setLoadingState] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const form = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    defaultValues: () => {
      // Prefer saved config, then draft, then empty
      if (config) return Promise.resolve(config);
      try {
        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) return Promise.resolve(JSON.parse(draft));
      } catch {}
      return Promise.resolve({ apiUrl: "", apiKey: "", instanceName: "" });
    },
  });

  // Persist draft on every change so navigation doesn't lose the values
  useEffect(() => {
    const sub = form.watch((values) => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    });
    return () => sub.unsubscribe();
  }, [form]);

  // ------------------------------------------------------------------
  // Poll connection state when config is set
  // ------------------------------------------------------------------
  const refreshState = useCallback(async () => {
    if (!config) return;
    setLoadingState(true);
    const state = await fetchConnectionState(config);
    setConnectionState(state);
    setLoadingState(false);
    if (state === "open") setQrCode(null);
  }, [config]);

  useEffect(() => {
    if (!config) return;
    refreshState();
    const interval = setInterval(refreshState, 10000);
    return () => clearInterval(interval);
  }, [config, refreshState]);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  function saveConfig(values: ConfigForm) {
    const cfg: EvoConfig = values;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    localStorage.removeItem(DRAFT_KEY);
    setConfig(cfg);
    setShowConfig(false);
    setConnectionState(null);
    setQrCode(null);
    toast({ title: "Configuração salva" });
  }

  async function handleConnect() {
    if (!config) return;
    setLoadingQr(true);
    try {
      // Try to create instance (may already exist — that's fine)
      await createInstance(config).catch(() => null);
      const qr = await fetchQrCode(config);
      if (qr) {
        setQrCode(qr);
      } else {
        toast({ title: "QR Code não disponível", description: "Verifique se a instância já está conectada.", variant: "destructive" });
        await refreshState();
      }
    } catch (err: any) {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
    } finally {
      setLoadingQr(false);
    }
  }

  async function handleRefreshQr() {
    if (!config) return;
    setLoadingQr(true);
    const qr = await fetchQrCode(config);
    if (qr) setQrCode(qr);
    else toast({ title: "Não foi possível atualizar o QR Code", variant: "destructive" });
    setLoadingQr(false);
  }

  async function handleLogout() {
    if (!config) return;
    setLoadingAction(true);
    try {
      await logoutInstance(config);
      setConnectionState("close");
      setQrCode(null);
      toast({ title: "WhatsApp desconectado" });
    } catch (err: any) {
      toast({ title: "Erro ao desconectar", description: err.message, variant: "destructive" });
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleDelete() {
    if (!config) return;
    setLoadingAction(true);
    try {
      await deleteInstance(config);
      setConnectionState(null);
      setQrCode(null);
      toast({ title: "Instância removida" });
    } catch (err: any) {
      toast({ title: "Erro ao remover instância", description: err.message, variant: "destructive" });
    } finally {
      setLoadingAction(false);
    }
  }

  // ------------------------------------------------------------------
  // Derived UI values
  // ------------------------------------------------------------------

  const isConnected = connectionState === "open";
  const isConnecting = connectionState === "connecting";

  function StatusBadge() {
    if (loadingState) return <Badge variant="outline"><Loader2 className="h-3 w-3 animate-spin mr-1" />Verificando</Badge>;
    if (connectionState === null) return <Badge variant="secondary">Não verificado</Badge>;
    if (isConnected) return <Badge className="bg-green-600 hover:bg-green-700"><Wifi className="h-3 w-3 mr-1" />Conectado</Badge>;
    if (isConnecting) return <Badge className="bg-amber-500 hover:bg-amber-600"><Loader2 className="h-3 w-3 animate-spin mr-1" />Conectando</Badge>;
    return <Badge variant="destructive"><WifiOff className="h-3 w-3 mr-1" />Desconectado</Badge>;
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp</h1>
          <p className="text-muted-foreground">Integração via Evolution API</p>
        </div>
        {config && (
          <Button variant="outline" size="sm" onClick={() => setShowConfig((v) => !v)}>
            <Settings className="h-4 w-4 mr-2" />
            {showConfig ? "Fechar" : "Configurar"}
          </Button>
        )}
      </div>

      {/* Config Form */}
      {showConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Configuração da Evolution API</CardTitle>
            <CardDescription>Informe os dados de acesso à sua instância da Evolution API.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(saveConfig)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="apiUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Evolution API</FormLabel>
                      <FormControl>
                        <Input placeholder="https://evolution.seudominio.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="sua-api-key-aqui" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="instanceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Instância</FormLabel>
                      <FormControl>
                        <Input placeholder="financeiro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  {config && (
                    <Button type="button" variant="outline" onClick={() => setShowConfig(false)}>
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit">Salvar configuração</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Connection Card */}
      {config && !showConfig && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle>Instância: {config.instanceName}</CardTitle>
                  <CardDescription className="truncate max-w-xs">{config.apiUrl}</CardDescription>
                </div>
              </div>
              <StatusBadge />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* QR Code */}
            {qrCode && !isConnected && (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-sm text-muted-foreground">Escaneie o QR Code com o WhatsApp</p>
                <div className="border rounded-xl p-3 bg-white">
                  <img
                    src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    className="h-56 w-56"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleRefreshQr} disabled={loadingQr}>
                  {loadingQr ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Atualizar QR Code
                </Button>
              </div>
            )}

            {isConnected && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-4 py-3">
                <Wifi className="h-5 w-5 text-green-600 shrink-0" />
                <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                  WhatsApp conectado e pronto para uso.
                </p>
              </div>
            )}

            <Separator />

            <div className="flex flex-wrap gap-2">
              {!isConnected && !qrCode && (
                <Button onClick={handleConnect} disabled={loadingQr}>
                  {loadingQr ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                  Conectar WhatsApp
                </Button>
              )}

              <Button variant="outline" onClick={refreshState} disabled={loadingState}>
                {loadingState ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Verificar status
              </Button>

              {isConnected && (
                <Button variant="outline" onClick={handleLogout} disabled={loadingAction}>
                  {loadingAction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                  Desconectar
                </Button>
              )}

              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                onClick={handleDelete}
                disabled={loadingAction}
              >
                Remover instância
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
