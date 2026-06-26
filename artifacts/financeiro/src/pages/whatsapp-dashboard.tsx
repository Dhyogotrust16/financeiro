import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useEvolutionConfig } from "@/hooks/use-whatsapp-config";
import {
  Inbox, UserCheck, CheckCircle2, Clock, MessageCircleOff,
  Loader2, RefreshCw, Plus, Trash2, Zap, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  open:      { label: "Abertas",         color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/30",   icon: Inbox },
  attending: { label: "Em atendimento",  color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950/30", icon: UserCheck },
  resolved:  { label: "Resolvidas",      color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950/30", icon: CheckCircle2 },
  pending:   { label: "Pendentes",       color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30", icon: Clock },
};

const TAG_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#6366f1"];

interface Metrics {
  byStatus: { status: string; count: string }[];
  unreadTotal: number;
  todayMessages: number;
  recentActivity: { day: string; count: string }[];
  topTags: { tag: string; count: string }[];
}

interface QuickReply { id: number; shortcut: string; title: string; body: string; }

export default function WhatsAppDashboard() {
  const { config, isReady } = useEvolutionConfig();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [newQR, setNewQR] = useState({ shortcut: "", title: "", body: "" });
  const [savingQR, setSavingQR] = useState(false);

  async function loadMetrics() {
    if (!config) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/whatsapp/metrics/${config.instanceName}`);
      const d = await r.json();
      setMetrics(d);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function loadQR() {
    if (!config) return;
    try {
      const r = await fetch(`/api/whatsapp/quick-replies/${config.instanceName}`);
      setQuickReplies(await r.json());
    } catch { /* ignore */ }
  }

  useEffect(() => { loadMetrics(); loadQR(); }, [config?.instanceName, isReady]);

  async function handleSaveQR() {
    if (!config || !newQR.shortcut || !newQR.title || !newQR.body) return;
    setSavingQR(true);
    try {
      const r = await fetch(`/api/whatsapp/quick-replies/${config.instanceName}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newQR, shortcut: newQR.shortcut.startsWith("/") ? newQR.shortcut : `/${newQR.shortcut}` }),
      });
      const saved = await r.json();
      setQuickReplies(prev => { const filtered = prev.filter(q => q.shortcut !== saved.shortcut); return [...filtered, saved].sort((a,b) => a.shortcut.localeCompare(b.shortcut)); });
      setNewQR({ shortcut: "", title: "", body: "" });
    } catch { /* ignore */ }
    setSavingQR(false);
  }

  async function handleDeleteQR(id: number) {
    if (!config) return;
    await fetch(`/api/whatsapp/quick-replies/${config.instanceName}/${id}`, { method: "DELETE" });
    setQuickReplies(prev => prev.filter(q => q.id !== id));
  }

  if (!isReady && !config) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p>Carregando configuração do WhatsApp...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-muted-foreground">
        <MessageCircleOff className="h-10 w-10" />
        <p>Configure a Evolution API primeiro em WhatsApp → Conexão.</p>
      </div>
    );
  }

  const statusMap = Object.fromEntries((metrics?.byStatus ?? []).map(s => [s.status, Number(s.count)]));
  const totalChats = Object.values(statusMap).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Métricas de Atendimento</h1>
          <p className="text-muted-foreground">Instância: {config.instanceName}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadMetrics} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(STATUS_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const count = statusMap[key] ?? 0;
          return (
            <Card key={key} className={`border-0 ${meta.bg}`}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>
                  <Icon className={`h-4 w-4 ${meta.color}`} />
                </div>
                <p className={`text-3xl font-bold ${meta.color}`}>{loading ? "—" : count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Extra stats */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total de conversas</span>
              <span className="text-xl font-bold">{loading ? "—" : totalChats}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Mensagens hoje</span>
              <span className="text-xl font-bold text-primary">{loading ? "—" : metrics?.todayMessages ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Não lidas</span>
              <Badge variant="destructive" className="text-sm px-2">{loading ? "—" : metrics?.unreadTotal ?? 0}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Activity chart */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Atividade últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-28 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={(metrics?.recentActivity ?? []).map(r => ({ day: r.day.slice(5), count: Number(r.count) }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" fontSize={10} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="count" name="Conversas" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top tags */}
      {(metrics?.topTags?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Etiquetas</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {metrics!.topTags.map((t, i) => (
                <div key={t.tag} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-medium" style={{ backgroundColor: TAG_COLORS[i % TAG_COLORS.length] }}>
                  {t.tag} <span className="opacity-80">({t.count})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick replies manager */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4" /> Respostas Rápidas
          </CardTitle>
          <p className="text-xs text-muted-foreground">Digite <code className="bg-muted px-1 rounded">/atalho</code> no chat para usar</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing */}
          <div className="space-y-2">
            {quickReplies.map(qr => (
              <div key={qr.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20 group">
                <code className="text-xs text-primary font-mono shrink-0 mt-0.5">{qr.shortcut}</code>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{qr.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{qr.body}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0" onClick={() => handleDeleteQR(qr.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {quickReplies.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma resposta rápida cadastrada.</p>}
          </div>

          {/* New */}
          <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Nova resposta rápida</p>
            <div className="grid grid-cols-2 gap-2">
              <Input value={newQR.shortcut} onChange={e => setNewQR(p => ({...p, shortcut: e.target.value}))} placeholder="/atalho" className="font-mono text-sm" />
              <Input value={newQR.title} onChange={e => setNewQR(p => ({...p, title: e.target.value}))} placeholder="Título" className="text-sm" />
            </div>
            <Textarea value={newQR.body} onChange={e => setNewQR(p => ({...p, body: e.target.value}))} placeholder="Texto da mensagem..." className="text-sm min-h-[70px] resize-none" />
            <Button size="sm" onClick={handleSaveQR} disabled={savingQR || !newQR.shortcut || !newQR.title || !newQR.body}>
              {savingQR ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
