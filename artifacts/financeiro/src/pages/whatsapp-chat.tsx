import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Loader2, Search, Send, MessageCircleOff, MoreVertical, ArrowLeft,
  Smile, Paperclip, RefreshCw, Users, X, Plus,
  UserCheck, Inbox, CheckCircle2, Clock, PhoneOff, ArrowRightLeft,
  BellOff, Phone, User, Hash, ChevronRight,
  FileText, Music, Video, Image as ImageIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = "evo_config";
interface EvoConfig { apiUrl: string; apiKey: string; instanceName: string; }
interface Tag { id: number; name: string; color: string; }
interface Department { id: number; name: string; color: string; }
interface QuickReply { id: number; shortcut: string; title: string; body: string; }

interface Contact {
  id: string; name: string; phone: string; isGroup: boolean;
  lastMessage?: string; lastMessageTime?: number; unread?: number;
  profilePic?: string; status?: string; assignedTo?: string | null;
  tags?: string[]; internalNotes?: string; protocol?: string;
  department?: string | null; closedAt?: string | null;
  closedBy?: string | null; subject?: string | null; markedUnread?: boolean;
  openedAt?: string | null;
}

interface Message {
  id: string; fromMe: boolean; body: string; timestamp: number;
  pushName?: string; type: "text" | "image" | "audio" | "video" | "document" | "other";
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; icon: React.ElementType }> = {
  open:      { label: "Na Fila",          color: "text-blue-600",   dot: "bg-blue-500",   icon: Inbox },
  attending: { label: "Em Atendimento",   color: "text-amber-600",  dot: "bg-amber-500",  icon: UserCheck },
  pending:   { label: "Pendente",         color: "text-orange-600", dot: "bg-orange-500", icon: Clock },
  resolved:  { label: "Resolvida",        color: "text-green-600",  dot: "bg-green-500",  icon: CheckCircle2 },
};

type TabView = "queue" | "chats" | "contacts";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getConfig(): EvoConfig | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); } catch { return null; }
}
function formatTime(ts: number) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}
function elapsed(openedAt?: string | null) {
  if (!openedAt) return "";
  const diff = Math.floor((Date.now() - new Date(openedAt).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function formatDate(ts: number) {
  const d = new Date(ts * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Hoje";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── API ─────────────────────────────────────────────────────────────────────
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function fetchContacts(cfg: EvoConfig): Promise<Contact[]> {
  const rows: any[] = await apiFetch(`/api/whatsapp/chats/${cfg.instanceName}`);
  return rows.map(r => ({
    id: r.remote_jid,
    name: r.name ?? r.push_name ?? r.remote_jid.replace(/@.+/, ""),
    phone: r.remote_jid.endsWith("@g.us") ? "Grupo" : `+${r.remote_jid.replace("@s.whatsapp.net", "")}`,
    isGroup: r.remote_jid.endsWith("@g.us"),
    lastMessage: r.last_message ?? "",
    lastMessageTime: Number(r.last_message_time) || 0,
    unread: r.unread_count ?? 0,
    profilePic: r.profile_pic ?? undefined,
    status: r.status ?? "open",
    assignedTo: r.assigned_to ?? null,
    tags: r.tags ?? [],
    internalNotes: r.internal_notes ?? "",
    protocol: r.protocol ?? "",
    department: r.department ?? null,
    closedAt: r.closed_at ?? null,
    closedBy: r.closed_by ?? null,
    subject: r.subject ?? null,
    markedUnread: r.marked_unread ?? false,
    openedAt: r.opened_at ?? null,
  }));
}
async function fetchMessages(cfg: EvoConfig, jid: string): Promise<Message[]> {
  const rows: any[] = await apiFetch(`/api/whatsapp/messages/${cfg.instanceName}/${encodeURIComponent(jid)}`);
  return rows.map(r => ({
    id: r.id, fromMe: r.from_me, body: r.body ?? "[mídia]",
    timestamp: Number(r.timestamp) || 0, pushName: r.push_name ?? "",
    type: (r.message_type as Message["type"]) ?? "text",
  }));
}
async function sendText(cfg: EvoConfig, jid: string, text: string) {
  return fetch("/api/evolution/proxy", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey, path: `/message/sendText/${cfg.instanceName}`, body: { number: jid, text } }),
  });
}
async function sendMediaFile(instanceName: string, jid: string, file: File) {
  return new Promise<void>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = async () => {
      const b64 = (fr.result as string).split(",")[1];
      const mt = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : "document";
      await fetch(`/api/whatsapp/send-media/${instanceName}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: jid, mediatype: mt, mimetype: file.type, fileName: file.name, media: b64 }),
      });
      resolve();
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
async function updateChat(cfg: EvoConfig, jid: string, data: object) {
  return apiFetch(`/api/whatsapp/chats/${cfg.instanceName}/${encodeURIComponent(jid)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
}
async function transferChat(cfg: EvoConfig, jid: string, data: { department: string; assignedTo?: string; comment?: string }) {
  return apiFetch(`/api/whatsapp/chats/${cfg.instanceName}/${encodeURIComponent(jid)}/transfer`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
}
async function closeChat(cfg: EvoConfig, jid: string, data: { subject?: string; closedBy?: string }) {
  return apiFetch(`/api/whatsapp/chats/${cfg.instanceName}/${encodeURIComponent(jid)}/close`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
}
async function reopenChat(cfg: EvoConfig, jid: string) {
  return apiFetch(`/api/whatsapp/chats/${cfg.instanceName}/${encodeURIComponent(jid)}/reopen`, { method: "POST" });
}
async function markUnread(cfg: EvoConfig, jid: string) {
  return apiFetch(`/api/whatsapp/chats/${cfg.instanceName}/${encodeURIComponent(jid)}/mark-unread`, { method: "POST" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ContactAvatar({ c, size = 11 }: { c: Pick<Contact, "name" | "isGroup" | "profilePic">; size?: number }) {
  const sz = `h-${size} w-${size}`;
  return (
    <Avatar className={`${sz} shrink-0`}>
      {c.profilePic
        ? <img src={c.profilePic} alt={c.name} className={`${sz} rounded-full object-cover`} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        : <AvatarFallback className={`font-semibold text-sm ${c.isGroup ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
            {c.isGroup ? <Users className="h-4 w-4" /> : initials(c.name)}
          </AvatarFallback>
      }
    </Avatar>
  );
}

function ContactRow({ c, active, onClick }: { c: Contact; active: boolean; onClick: () => void }) {
  const dot = STATUS_CONFIG[c.status ?? "open"]?.dot ?? "bg-blue-500";
  const hasAlert = (c.unread ?? 0) > 0 || c.markedUnread;
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-left border-b border-border/30 ${active ? "bg-muted" : ""}`}>
      <div className="relative shrink-0">
        <ContactAvatar c={c} />
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${dot}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-1">
          <span className={`text-sm truncate ${hasAlert ? "font-semibold" : "font-medium"}`}>{c.name}</span>
          <div className="flex items-center gap-1 shrink-0">
            {c.openedAt && c.status !== "resolved" && (
              <span className="text-[10px] text-muted-foreground">{elapsed(c.openedAt)}</span>
            )}
            {!!c.lastMessageTime && <span className={`text-xs ${hasAlert ? "text-green-600 font-semibold" : "text-muted-foreground"}`}>{formatTime(c.lastMessageTime)}</span>}
          </div>
        </div>
        <div className="flex items-center justify-between mt-0.5 gap-1">
          <span className="text-xs text-muted-foreground truncate">{c.lastMessage || c.phone}</span>
          <div className="flex items-center gap-1 shrink-0">
            {c.protocol && <span className="text-[10px] text-muted-foreground font-mono">#{c.protocol}</span>}
            {c.markedUnread && !c.unread && <span className="h-2.5 w-2.5 rounded-full bg-green-500" />}
            {(c.unread ?? 0) > 0 && <span className="h-5 min-w-5 px-1 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center">{c.unread! > 99 ? "99+" : c.unread}</span>}
          </div>
        </div>
        {c.department && <span className="text-[10px] text-muted-foreground">{c.department}</span>}
        {(c.tags ?? []).length > 0 && (
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {c.tags!.slice(0, 2).map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>)}
          </div>
        )}
      </div>
    </button>
  );
}

// Date separator
function DateSeparator({ ts }: { ts: number }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border/50" />
      <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-0.5 rounded-full font-medium">{formatDate(ts)}</span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

// Media content inside bubble
function MediaContent({ msg }: { msg: Message }) {
  const isMedia = ["image","audio","video","document"].includes(msg.type as string);
  if (!isMedia || msg.body.startsWith("[") === false) return null;
  const fileName = msg.body.replace(/^\[|\]$/g, "");
  if (msg.type === "image") return (
    <div className="flex items-center gap-2 mb-1 p-2 rounded-lg bg-black/10">
      <ImageIcon className="h-5 w-5 shrink-0" /><span className="text-xs truncate">{fileName}</span>
    </div>
  );
  if (msg.type === "audio") return (
    <div className="flex items-center gap-2 mb-1 p-2 rounded-lg bg-black/10">
      <Music className="h-5 w-5 shrink-0" /><span className="text-xs">Áudio</span>
    </div>
  );
  if (msg.type === "video") return (
    <div className="flex items-center gap-2 mb-1 p-2 rounded-lg bg-black/10">
      <Video className="h-5 w-5 shrink-0" /><span className="text-xs truncate">{fileName}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2 mb-1 p-2 rounded-lg bg-black/10">
      <FileText className="h-5 w-5 shrink-0" /><span className="text-xs truncate">{fileName}</span>
    </div>
  );
}

function MsgBubble({ msg, showName, agentName, isFirst }: {
  msg: Message; showName: boolean; agentName?: string; isFirst: boolean;
}) {
  const isMedia = ["image","audio","video","document"].includes(msg.type as string) && msg.body.startsWith("[");
  return (
    <div className={`flex ${msg.fromMe ? "justify-end" : "justify-start"} ${isFirst ? "mt-2" : "mt-0.5"}`}>
      <div className={`max-w-[72%] px-3 py-2 rounded-2xl text-sm shadow-sm
        ${msg.fromMe
          ? "bg-[#dcf8c6] dark:bg-[#005c4b] text-gray-800 dark:text-gray-100 rounded-tr-sm"
          : "bg-white dark:bg-[#202c33] text-gray-800 dark:text-gray-100 rounded-tl-sm"}`}>
        {isFirst && msg.fromMe && agentName && (
          <p className="text-[11px] font-bold text-green-700 dark:text-green-400 mb-0.5">{agentName}</p>
        )}
        {isFirst && !msg.fromMe && showName && msg.pushName && (
          <p className="text-[11px] font-bold text-blue-600 mb-0.5">{msg.pushName}</p>
        )}
        {isMedia && <MediaContent msg={msg} />}
        {!isMedia && <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>}
        <p className={`text-[10px] mt-1 text-right ${msg.fromMe ? "text-green-700/60" : "text-muted-foreground"}`}>
          {formatTime(msg.timestamp)}
        </p>
      </div>
    </div>
  );
}

// ─── Transfer modal ───────────────────────────────────────────────────────────
function TransferModal({ open, onClose, departments, onTransfer }: {
  open: boolean; onClose: () => void;
  departments: Department[];
  onTransfer: (dept: string, agent: string, comment: string) => Promise<void>;
}) {
  const [dept, setDept] = useState("");
  const [agent, setAgent] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  async function handle() {
    if (!dept) return;
    setSaving(true);
    await onTransfer(dept, agent, comment);
    setSaving(false); setDept(""); setAgent(""); setComment(""); onClose();
  }
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Transferir Chamado</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Departamento *</Label>
            <select value={dept} onChange={e => setDept(e.target.value)} className="w-full mt-1 h-9 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Selecione...</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Atendente (opcional)</Label>
            <Input value={agent} onChange={e => setAgent(e.target.value)} placeholder="Nome do atendente" className="mt-1 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Comentário (opcional)</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Contexto para o próximo atendente..." className="mt-1 text-sm min-h-[70px] resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handle} disabled={!dept || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Close modal ─────────────────────────────────────────────────────────────
function CloseModal({ open, onClose, onConfirm }: {
  open: boolean; onClose: () => void;
  onConfirm: (subject: string) => Promise<void>;
}) {
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);
  async function handle() {
    setSaving(true);
    await onConfirm(subject);
    setSaving(false); setSubject(""); onClose();
  }
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><PhoneOff className="h-4 w-4" /> Encerrar Chamado</DialogTitle></DialogHeader>
        <div>
          <Label className="text-xs">Assunto do chamado (recomendado)</Label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ex: Dúvida sobre cobrança" className="mt-1 h-9 text-sm" />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant="destructive" onClick={handle} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PhoneOff className="h-4 w-4 mr-2" />}
            Fechar chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Right panel ─────────────────────────────────────────────────────────────
const TAG_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];

interface InternalComment { id: number; author: string; body: string; created_at: string; }

function RightPanel({ contact, cfg, allTags, departments, agentName, onUpdate, onRefreshTags }: {
  contact: Contact; cfg: EvoConfig; agentName: string;
  allTags: Tag[]; departments: Department[];
  onUpdate: (p: Partial<Contact>) => void;
  onRefreshTags: () => void;
}) {
  const [section, setSection] = useState<"info" | "comments" | "schedule" | "fields">("info");
  const [notes, setNotes] = useState(contact.internalNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [newTag, setNewTag] = useState(""); const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [addingTag, setAddingTag] = useState(false);
  // Comments
  const [comments, setComments] = useState<InternalComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  // Schedule
  const [schedText, setSchedText] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [savingSched, setSavingSched] = useState(false);
  const [scheduled, setScheduled] = useState<any[]>([]);
  // Fields
  const [fields, setFields] = useState<Record<string, string>>({});
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldVal, setNewFieldVal] = useState("");
  const [savingField, setSavingField] = useState(false);

  useEffect(() => { setNotes(contact.internalNotes ?? ""); }, [contact.id]);

  useEffect(() => {
    if (section === "comments") {
      apiFetch(`/api/whatsapp/comments/${cfg.instanceName}/${encodeURIComponent(contact.id)}`)
        .then(setComments).catch(() => {});
    }
    if (section === "schedule") {
      apiFetch(`/api/whatsapp/scheduled/${cfg.instanceName}`)
        .then((all: any[]) => setScheduled(all.filter(s => s.remote_jid === contact.id)))
        .catch(() => {});
    }
    if (section === "fields") {
      apiFetch(`/api/whatsapp/contact-fields/${cfg.instanceName}/${encodeURIComponent(contact.id)}`)
        .then(setFields).catch(() => {});
    }
  }, [section, contact.id]);

  async function saveNotes() {
    setSavingNotes(true);
    await updateChat(cfg, contact.id, { internalNotes: notes });
    onUpdate({ internalNotes: notes }); setSavingNotes(false);
  }
  async function toggleTag(name: string) {
    const tags = (contact.tags ?? []).includes(name)
      ? (contact.tags ?? []).filter(t => t !== name)
      : [...(contact.tags ?? []), name];
    await updateChat(cfg, contact.id, { tags }); onUpdate({ tags });
  }
  async function addTag() {
    if (!newTag.trim()) return;
    setAddingTag(true);
    await apiFetch(`/api/whatsapp/tags/${cfg.instanceName}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newTag.trim(), color: newTagColor }) });
    onRefreshTags(); setNewTag(""); setAddingTag(false);
  }
  async function delTag(name: string) {
    await fetch(`/api/whatsapp/tags/${cfg.instanceName}/${encodeURIComponent(name)}`, { method: "DELETE" });
    const tags = (contact.tags ?? []).filter(t => t !== name);
    await updateChat(cfg, contact.id, { tags }); onUpdate({ tags }); onRefreshTags();
  }
  async function sendComment() {
    if (!commentText.trim()) return;
    setSendingComment(true);
    const c = await apiFetch(`/api/whatsapp/comments/${cfg.instanceName}/${encodeURIComponent(contact.id)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: agentName, body: commentText.trim() }),
    });
    setComments(prev => [...prev, c]); setCommentText(""); setSendingComment(false);
  }
  async function scheduleMsg() {
    if (!schedText.trim() || !schedDate || !schedTime) return;
    setSavingSched(true);
    const scheduledAt = `${schedDate}T${schedTime}:00`;
    const s = await apiFetch(`/api/whatsapp/scheduled/${cfg.instanceName}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remoteJid: contact.id, body: schedText.trim(), scheduledAt, createdBy: agentName }),
    });
    setScheduled(prev => [...prev, s]); setSchedText(""); setSchedDate(""); setSchedTime(""); setSavingSched(false);
  }
  async function saveField() {
    if (!newFieldKey.trim()) return;
    setSavingField(true);
    const upd = { ...fields, [newFieldKey.trim()]: newFieldVal };
    await apiFetch(`/api/whatsapp/contact-fields/${cfg.instanceName}/${encodeURIComponent(contact.id)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upd),
    });
    setFields(upd); setNewFieldKey(""); setNewFieldVal(""); setSavingField(false);
  }

  const tabs = [
    { key: "info", label: "Info" },
    { key: "comments", label: "💬" },
    { key: "schedule", label: "🕐" },
    { key: "fields", label: "📋" },
  ] as const;

  return (
    <div className="w-[260px] shrink-0 border-l border-border flex flex-col bg-background overflow-y-auto">
      {/* Contact card */}
      <div className="flex flex-col items-center gap-2 p-4 border-b border-border text-center">
        <ContactAvatar c={contact} size={12} />
        <div>
          <p className="font-semibold text-sm leading-tight">{contact.name}</p>
          <p className="text-xs text-muted-foreground">{contact.phone}</p>
          {contact.protocol && <p className="text-xs font-mono text-muted-foreground mt-0.5">#{contact.protocol}</p>}
        </div>
        <div className="flex flex-col gap-1 w-full mt-1 text-left">
          {contact.department && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Hash className="h-3 w-3" />{contact.department}</div>}
          {contact.assignedTo && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><User className="h-3 w-3" />{contact.assignedTo}</div>}
          {contact.openedAt && contact.status !== "resolved" && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3 w-3" />Aberto há {elapsed(contact.openedAt)}</div>}
          {contact.subject && <div className="flex items-start gap-1.5 text-xs text-muted-foreground"><span className="shrink-0">📌</span><span>{contact.subject}</span></div>}
        </div>
        {/* Tags inline */}
        {(contact.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 w-full">
            {contact.tags!.map(t => {
              const def = allTags.find(x => x.name === t);
              return <span key={t} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: def?.color ?? "#6366f1" }}>{t}</span>;
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setSection(t.key)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${section === t.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── INFO ── */}
      {section === "info" && (
        <div className="p-3 space-y-3 overflow-y-auto flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(STATUS_CONFIG).map(([key, val]) => {
              const Icon = val.icon;
              const active = (contact.status ?? "open") === key;
              return (
                <button key={key} onClick={async () => { await updateChat(cfg, contact.id, { status: key }); onUpdate({ status: key }); }}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />{val.label}
                </button>
              );
            })}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Departamento</p>
            <select value={contact.department ?? ""} onChange={async e => { await updateChat(cfg, contact.id, { department: e.target.value }); onUpdate({ department: e.target.value }); }}
              className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background">
              <option value="">Nenhum</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Etiquetas</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {allTags.map(tag => {
                const active = (contact.tags ?? []).includes(tag.name);
                return (
                  <div key={tag.name} className="flex items-center gap-0.5 group">
                    <button onClick={() => toggleTag(tag.name)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${active ? "text-white border-transparent" : "border-border text-muted-foreground"}`}
                      style={active ? { backgroundColor: tag.color, borderColor: tag.color } : {}}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />{tag.name}
                    </button>
                    <button onClick={() => delTag(tag.name)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"><X className="h-3 w-3" /></button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1">
              <div className="flex gap-0.5">{TAG_COLORS.map(c => <button key={c} onClick={() => setNewTagColor(c)} className={`h-4 w-4 rounded-full border-2 ${newTagColor === c ? "border-primary scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />)}</div>
              <Input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} placeholder="Nova etiqueta" className="h-7 text-xs flex-1" />
              <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={addTag} disabled={addingTag || !newTag.trim()}><Plus className="h-3 w-3" /></Button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Notas internas</p>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anotações para a equipe..." className="text-xs min-h-[80px] resize-none" />
            <Button size="sm" variant="outline" className="w-full mt-1 text-xs" onClick={saveNotes} disabled={savingNotes}>
              {savingNotes && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Salvar nota
            </Button>
          </div>
        </div>
      )}

      {/* ── COMMENTS ── */}
      {section === "comments" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum comentário interno</p>}
            {comments.map(c => (
              <div key={c.id} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">{c.author}</p>
                <p className="text-xs mt-0.5 whitespace-pre-wrap">{c.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString("pt-BR", { day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit" })}</p>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border space-y-2">
            <p className="text-[10px] text-amber-600 font-medium">⚠️ Não enviado ao cliente</p>
            <Textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Comentário interno..." className="text-xs min-h-[60px] resize-none" />
            <Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-white" onClick={sendComment} disabled={sendingComment || !commentText.trim()}>
              {sendingComment ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Comentar
            </Button>
          </div>
        </div>
      )}

      {/* ── SCHEDULE ── */}
      {section === "schedule" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {scheduled.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mensagem agendada</p>}
            {scheduled.map(s => (
              <div key={s.id} className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-lg px-3 py-2">
                <p className="text-xs whitespace-pre-wrap mb-1">{s.body}</p>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-blue-600">{new Date(s.scheduled_at).toLocaleString("pt-BR", { day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit" })}</p>
                  <button onClick={async () => { await apiFetch(`/api/whatsapp/scheduled/${cfg.instanceName}/${s.id}`, { method: "DELETE" }); setScheduled(prev => prev.filter(x => x.id !== s.id)); }} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border space-y-2">
            <Textarea value={schedText} onChange={e => setSchedText(e.target.value)} placeholder="Mensagem a enviar..." className="text-xs min-h-[60px] resize-none" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} className="h-7 text-xs" />
              <Input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} className="h-7 text-xs" />
            </div>
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={scheduleMsg} disabled={savingSched || !schedText.trim() || !schedDate || !schedTime}>
              {savingSched ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Agendar mensagem
            </Button>
          </div>
        </div>
      )}

      {/* ── FIELDS ── */}
      {section === "fields" && (
        <div className="p-3 space-y-3 flex-1 overflow-y-auto">
          {Object.entries(fields).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum campo personalizado</p>}
          {Object.entries(fields).map(([k, v]) => (
            <div key={k} className="space-y-0.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">{k}</p>
              <Input defaultValue={v} onBlur={async e => {
                const upd = { ...fields, [k]: e.target.value };
                setFields(upd);
                await apiFetch(`/api/whatsapp/contact-fields/${cfg.instanceName}/${encodeURIComponent(contact.id)}`, {
                  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upd),
                });
              }} className="h-7 text-xs" />
            </div>
          ))}
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Novo campo</p>
            <Input value={newFieldKey} onChange={e => setNewFieldKey(e.target.value)} placeholder="Nome do campo" className="h-7 text-xs" />
            <Input value={newFieldVal} onChange={e => setNewFieldVal(e.target.value)} placeholder="Valor" className="h-7 text-xs" />
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={saveField} disabled={savingField || !newFieldKey.trim()}>
              {savingField ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}Adicionar campo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WhatsAppChat() {
  const cfg = getConfig();
  const { user } = useAuth();
  const agentName = user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? "Você";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabView>("queue");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [showPanel, setShowPanel] = useState(true);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [qrFilter, setQrFilter] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    if (!cfg) return;
    setLoading(true); setError(null);
    try {
      fetch(`/api/whatsapp/chats/${cfg.instanceName}/fix-group-names`, { method: "POST" }).catch(() => {});
      const data = await fetchContacts(cfg);
      setContacts(prev => {
        // Detect new unread messages for notification
        const prevTotal = prev.reduce((s, c) => s + (c.unread ?? 0), 0);
        const newTotal = data.reduce((s, c) => s + (c.unread ?? 0), 0);
        if (newTotal > prevTotal && document.hidden) {
          document.title = `(${newTotal}) Atendimento - Sistema Financeiro`;
          // Play subtle notification sound
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 880; osc.type = "sine";
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
          } catch { /* ignore */ }
        } else if (newTotal === 0) {
          document.title = "Atendimento - Sistema Financeiro";
        }
        return data;
      });
      if (selected) { const u = data.find(c => c.id === selected.id); if (u) setSelected(u); }
      if (!data.length) setError("Nenhuma conversa. Verifique se o WhatsApp está conectado.");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [cfg?.instanceName]);

  const loadMeta = useCallback(async () => {
    if (!cfg) return;
    try {
      const [tags, depts, qrs] = await Promise.all([
        apiFetch(`/api/whatsapp/tags/${cfg.instanceName}`),
        apiFetch(`/api/whatsapp/departments/${cfg.instanceName}`),
        apiFetch(`/api/whatsapp/quick-replies/${cfg.instanceName}`),
      ]);
      setAllTags(tags); setDepartments(depts); setQuickReplies(qrs);
    } catch { /* ignore */ }
  }, [cfg?.instanceName]);

  useEffect(() => { reload(); loadMeta(); }, [reload, loadMeta]);

  // Restore title when tab focused
  useEffect(() => {
    const onFocus = () => { document.title = "Atendimento - Sistema Financeiro"; };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Poll contact list every 8s
  useEffect(() => {
    const t = setInterval(reload, 8000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    if (!selected || !cfg) return;
    let cancelled = false;
    const load = async () => {
      setLoadingMsgs(true);
      try { const m = await fetchMessages(cfg, selected.id); if (!cancelled) setMessages(m); } catch { /* */ }
      if (!cancelled) setLoadingMsgs(false);
    };
    load();
    const t = setInterval(load, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, [selected?.id]);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [messages, selected?.id]);

  async function selectContact(c: Contact) {
    setSelected(c); setMobileView("chat");
    if (c.unread || c.markedUnread) {
      await fetch(`/api/whatsapp/messages/${cfg!.instanceName}/${encodeURIComponent(c.id)}/read`, { method: "POST" });
      await fetch(`/api/whatsapp/chats/${cfg!.instanceName}/${encodeURIComponent(c.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markedUnread: false }),
      });
      setContacts(prev => prev.map(x => x.id === c.id ? { ...x, unread: 0, markedUnread: false } : x));
    }
  }

  function updateSelected(patch: Partial<Contact>) {
    if (!selected) return;
    const u = { ...selected, ...patch };
    setSelected(u);
    setContacts(prev => prev.map(c => c.id === u.id ? u : c));
  }

  async function handleSend() {
    if (!cfg || !selected || !text.trim()) return;
    const body = text.trim(); setText(""); setShowQR(false); setSending(true);
    const opt: Message = { id: `opt-${Date.now()}`, fromMe: true, body, timestamp: Math.floor(Date.now() / 1000), type: "text" };
    setMessages(prev => [...prev, opt]);
    try { await sendText(cfg, selected.id, body); } catch { setMessages(prev => prev.filter(m => m.id !== opt.id)); }
    setSending(false);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !cfg || !selected) return;
    setSending(true);
    const opt: Message = { id: `opt-${Date.now()}`, fromMe: true, body: `[${file.name}]`, timestamp: Math.floor(Date.now() / 1000), type: "document" };
    setMessages(prev => [...prev, opt]);
    try { await sendMediaFile(cfg.instanceName, selected.id, file); } catch { setMessages(prev => prev.filter(m => m.id !== opt.id)); }
    setSending(false); if (fileRef.current) fileRef.current.value = "";
  }

  function handleTextChange(v: string) {
    setText(v);
    if (v.startsWith("/")) { setQrFilter(v.slice(1).toLowerCase()); setShowQR(true); }
    else setShowQR(false);
  }

  // Filtered contacts per tab
  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const match = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.protocol ?? "").includes(q);
    if (!match) return false;
    if (tab === "queue") return c.status === "open" || c.status === "pending";
    if (tab === "chats") return c.status === "attending";
    return true; // contacts = all
  }).sort((a, b) => (b.lastMessageTime ?? 0) - (a.lastMessageTime ?? 0));

  const queueCount = contacts.filter(c => c.status === "open" || c.status === "pending").length;
  const chatsCount = contacts.filter(c => c.status === "attending").length;
  const unreadTotal = contacts.reduce((s, c) => s + (c.unread ?? 0) + (c.markedUnread ? 1 : 0), 0);
  const filteredQR = quickReplies.filter(q => q.shortcut.includes(qrFilter) || q.title.toLowerCase().includes(qrFilter));

  if (!cfg) return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-center gap-3 text-muted-foreground">
      <MessageCircleOff className="h-12 w-12" />
      <p className="font-medium">Configure a Evolution API em WhatsApp → Conexão.</p>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl overflow-hidden border border-border shadow-sm bg-background">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div className={`flex flex-col w-full md:w-[320px] md:min-w-[320px] border-r border-border bg-background ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-border">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Atendimento</span>
            {unreadTotal > 0 && <span className="h-5 min-w-5 px-1 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center">{unreadTotal}</span>}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reload} disabled={loading} title="Atualizar">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        {/* Tabs: Fila / Chats / Contatos */}
        <div className="flex border-b border-border bg-[#f0f2f5] dark:bg-[#202c33]">
          {([
            { key: "queue",    label: "Fila",     count: queueCount },
            { key: "chats",    label: "Chats",    count: chatsCount },
            { key: "contacts", label: "Contatos", count: contacts.length },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${tab === t.key ? "border-b-2 border-green-500 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
              <span className={`text-[10px] px-1 rounded-full ${tab === t.key ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-[#f0f2f5] dark:bg-[#202c33]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nome, número, #protocolo..." className="pl-8 h-8 text-xs bg-white dark:bg-[#2a3942] border-0 rounded-lg" />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && !contacts.length ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin" /><span className="text-sm">Carregando...</span>
            </div>
          ) : error ? (
            <div className="m-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">{error}</div>
          ) : !filtered.length ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {tab === "queue" ? "Fila vazia" : tab === "chats" ? "Nenhum chat em andamento" : "Nenhum contato"}
            </div>
          ) : filtered.map(c => (
            <ContactRow key={c.id} c={c} active={selected?.id === c.id} onClick={() => selectContact(c)} />
          ))}
        </div>
      </div>

      {/* ── Chat area ──────────────────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 min-w-0 ${mobileView === "list" ? "hidden md:flex" : "flex"}`}
        style={{ background: "hsl(var(--muted)/0.15)" }}>
        {selected ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-border shrink-0">
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setMobileView("list")}><ArrowLeft className="h-4 w-4" /></Button>
              <ContactAvatar c={selected} size={9} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{selected.name}</p>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_CONFIG[selected.status ?? "open"]?.dot}`} />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{selected.phone}</span>
                  {selected.protocol && <span className="font-mono">#{selected.protocol}</span>}
                  {selected.department && <span className="text-primary font-medium">{selected.department}</span>}
                  {selected.assignedTo && <span>· {selected.assignedTo}</span>}
                  {messages.length > 0 && <span className="ml-auto">{messages.length} msgs</span>}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Call via WhatsApp */}
                {!selected.isGroup && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Ligar pelo WhatsApp"
                    onClick={() => {
                      const num = selected.id.replace("@s.whatsapp.net", "");
                      window.open(`https://wa.me/${num}`, "_blank");
                    }}>
                    <Phone className="h-4 w-4" />
                  </Button>
                )}
                {/* Transfer */}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Transferir" onClick={() => setShowTransfer(true)}>
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
                {/* Close / Reopen */}
                {selected.status === "resolved" ? (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Reabrir chamado" onClick={async () => {
                    const r = await reopenChat(cfg, selected.id);
                    updateSelected({ ...r, status: "open" });
                  }}>
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Encerrar chamado" onClick={() => setShowClose(true)}>
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                )}
                {/* Mark unread */}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Marcar como não lido" onClick={async () => {
                  await markUnread(cfg, selected.id);
                  updateSelected({ markedUnread: true });
                }}>
                  <BellOff className="h-4 w-4" />
                </Button>
                {/* More / status quick change */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuSeparator />
                    <p className="text-[10px] px-2 py-1 text-muted-foreground uppercase font-semibold">Alterar status</p>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => {
                      const Icon = v.icon;
                      return (
                        <DropdownMenuItem key={k} onClick={async () => { await updateChat(cfg, selected.id, { status: k }); updateSelected({ status: k }); }}>
                          <Icon className="h-4 w-4 mr-2" />{v.label}
                        </DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowPanel(v => !v)}>
                      <ChevronRight className="h-4 w-4 mr-2" />{showPanel ? "Ocultar painel" : "Mostrar painel"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Tags bar */}
            {(selected.tags ?? []).length > 0 && (
              <div className="flex gap-1 px-4 py-1.5 bg-background/60 border-b border-border flex-wrap">
                {selected.tags!.map(t => {
                  const def = allTags.find(x => x.name === t);
                  return <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: def?.color ?? "#6366f1" }}>{t}</span>;
                })}
              </div>
            )}

            {/* Closed banner */}
            {selected.status === "resolved" && (
              <div className="flex items-center justify-between px-4 py-2 bg-green-50 dark:bg-green-950/20 border-b border-green-200 dark:border-green-900">
                <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Chamado encerrado{selected.closedBy ? ` por ${selected.closedBy}` : ""}
                  {selected.subject && <span>· {selected.subject}</span>}
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => { const r = await reopenChat(cfg, selected.id); updateSelected({ ...r }); }}>
                  Reabrir
                </Button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loadingMsgs && !messages.length ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !messages.length ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhuma mensagem ainda</div>
              ) : (
                <>
                  {messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const prevDate = prev ? formatDate(prev.timestamp) : null;
                    const thisDate = formatDate(m.timestamp);
                    const showDate = thisDate !== prevDate;
                    // Group consecutive same-sender messages within 2 min
                    const isFirst = !prev || prev.fromMe !== m.fromMe || (m.timestamp - prev.timestamp) > 120;
                    return (
                      <div key={m.id}>
                        {showDate && <DateSeparator ts={m.timestamp} />}
                        <MsgBubble msg={m} showName={selected.isGroup} agentName={agentName} isFirst={isFirst} />
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Input area */}
            <div className="border-t border-border shrink-0">
              {/* Quick replies */}
              {showQR && filteredQR.length > 0 && (
                <div className="px-4 py-2 bg-background border-b border-border max-h-44 overflow-y-auto">
                  <p className="text-[10px] text-muted-foreground mb-1.5 font-semibold uppercase">Respostas rápidas</p>
                  {filteredQR.map(q => (
                    <button key={q.id} onClick={() => { setText(q.body); setShowQR(false); }}
                      className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-muted text-left">
                      <span className="text-xs font-mono text-primary shrink-0">{q.shortcut}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{q.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{q.body}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33]">
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground"><Smile className="h-5 w-5" /></Button>
                <input ref={fileRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleFile} />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground" onClick={() => fileRef.current?.click()}><Paperclip className="h-5 w-5" /></Button>
                <Input value={text} onChange={e => handleTextChange(e.target.value)}
                  onKeyDown={e => { if (e.key === "Escape") { setShowQR(false); return; } if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Digite / para respostas rápidas..." className="flex-1 h-9 bg-white dark:bg-[#2a3942] border-0 rounded-lg text-sm" disabled={sending} />
                <Button size="icon" className="h-9 w-9 shrink-0 bg-green-600 hover:bg-green-700 text-white rounded-full" onClick={handleSend} disabled={sending || !text.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-10 w-10 text-green-600" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-lg">Sistema de Atendimento</p>
              <p className="text-sm text-muted-foreground mt-1">Selecione um chamado da <strong>Fila</strong> para iniciar</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      {selected && showPanel && (
        <div className="hidden xl:flex">
          <RightPanel contact={selected} cfg={cfg} agentName={agentName} allTags={allTags} departments={departments} onUpdate={updateSelected} onRefreshTags={loadMeta} />
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <TransferModal open={showTransfer} onClose={() => setShowTransfer(false)} departments={departments}
        onTransfer={async (dept, agent, comment) => {
          try {
            const r = await transferChat(cfg, selected!.id, { department: dept, assignedTo: agent || undefined, comment: comment || undefined });
            updateSelected({ ...r });
          } catch { /* ignore */ }
        }} />
      <CloseModal open={showClose} onClose={() => setShowClose(false)}
        onConfirm={async (subject) => {
          const r = await closeChat(cfg, selected!.id, { subject, closedBy: "Você" });
          updateSelected({ ...r });
          setTab("contacts");
        }} />
    </div>
  );
}
