import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Receipt,
  FileText,
  Tags,
  Menu,
  Moon,
  Sun,
  LogOut,
  ArrowRightLeft,
  ArrowDownToLine,
  ArrowUpToLine,
  MessageCircle,
  ChevronDown,
  Wifi,
  MessageSquare,
  BarChart2,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "../ThemeProvider";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";

type NavTone =
  | "sky"
  | "violet"
  | "emerald"
  | "rose"
  | "amber"
  | "cyan"
  | "orange"
  | "fuchsia"
  | "lime"
  | "blue"
  | "teal"
  | "indigo";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  tone: NavTone;
}

const NAV_ICON_TONES: Record<NavTone, string> = {
  sky: "bg-sky-500/15 text-sky-600 ring-sky-500/20 dark:text-sky-400",
  violet: "bg-violet-500/15 text-violet-600 ring-violet-500/20 dark:text-violet-400",
  emerald: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  rose: "bg-rose-500/15 text-rose-600 ring-rose-500/20 dark:text-rose-400",
  amber: "bg-amber-500/15 text-amber-700 ring-amber-500/20 dark:text-amber-400",
  cyan: "bg-cyan-500/15 text-cyan-600 ring-cyan-500/20 dark:text-cyan-400",
  orange: "bg-orange-500/15 text-orange-600 ring-orange-500/20 dark:text-orange-400",
  fuchsia: "bg-fuchsia-500/15 text-fuchsia-600 ring-fuchsia-500/20 dark:text-fuchsia-400",
  lime: "bg-lime-500/15 text-lime-700 ring-lime-500/20 dark:text-lime-400",
  blue: "bg-blue-500/15 text-blue-600 ring-blue-500/20 dark:text-blue-400",
  teal: "bg-teal-500/15 text-teal-600 ring-teal-500/20 dark:text-teal-400",
  indigo: "bg-indigo-500/15 text-indigo-600 ring-indigo-500/20 dark:text-indigo-400",
};

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, tone: "sky" },
  { title: "Clientes", href: "/clientes", icon: Users, tone: "violet" },
  { title: "Receitas", href: "/receitas", icon: ArrowDownToLine, tone: "emerald" },
  { title: "Despesas", href: "/despesas", icon: ArrowUpToLine, tone: "rose" },
  { title: "Cobranças", href: "/cobrancas", icon: Receipt, tone: "amber" },
  { title: "Contas a Receber", href: "/contas-receber", icon: Wallet, tone: "cyan" },
  { title: "Contas a Pagar", href: "/contas-pagar", icon: ArrowRightLeft, tone: "orange" },
  { title: "Relatórios", href: "/relatorios", icon: FileText, tone: "fuchsia" },
  { title: "Categorias", href: "/categorias", icon: Tags, tone: "lime" },
];

const whatsappSubItems: NavItem[] = [
  { title: "Conexão", href: "/whatsapp", icon: Wifi, tone: "blue" },
  { title: "Chat", href: "/whatsapp/chat", icon: MessageSquare, tone: "teal" },
  { title: "Métricas", href: "/whatsapp/dashboard", icon: BarChart2, tone: "indigo" },
];

function NavIcon({
  icon: Icon,
  tone,
  active,
  compact = false,
}: {
  icon: React.ElementType;
  tone: NavTone;
  active?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md ring-1 transition-colors ${
        compact ? "h-7 w-7" : "h-8 w-8"
      } ${
        active
          ? "bg-white/15 text-white ring-white/10 shadow-sm"
          : NAV_ICON_TONES[tone]
      }`}
    >
      <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </span>
  );
}

function NavLinks({ onClick }: { onClick?: () => void }) {
  const [location] = useLocation();
  const isWhatsAppActive = location.startsWith("/whatsapp");
  const [wppOpen, setWppOpen] = useState(isWhatsAppActive);

  return (
    <nav className="space-y-1 p-4">
      {navItems.map((item) => {
        const isActive = location === item.href || location.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href}>
            <span
              onClick={onClick}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <NavIcon icon={item.icon} tone={item.tone} active={isActive} />
              {item.title}
            </span>
          </Link>
        );
      })}

      {/* WhatsApp with submenu */}
      <div>
        <button
          onClick={() => setWppOpen((v) => !v)}
          className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
            isWhatsAppActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <NavIcon icon={MessageCircle} tone="emerald" active={isWhatsAppActive} />
          <span className="flex-1 text-left">WhatsApp</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${wppOpen ? "rotate-180" : ""}`} />
        </button>
        {wppOpen && (
          <div className="mt-1 ml-4 space-y-1 border-l border-border pl-3">
            {whatsappSubItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <span
                    onClick={onClick}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <NavIcon icon={item.icon} tone={item.tone} active={isActive} compact />
                    {item.title}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const displayName = user?.user_metadata?.name ?? user?.email ?? "Usuário";

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-muted/20">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
        <div className="flex items-center gap-3">
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex h-16 items-center border-b px-6">
                <span className="text-lg font-bold">Sistema Financeiro</span>
              </div>
              <div className="overflow-y-auto h-[calc(100vh-4rem)]">
                <NavLinks onClick={() => setIsMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <span className="text-lg font-bold">Sistema Financeiro</span>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-background md:flex fixed inset-y-0">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-lg font-bold">Sistema Financeiro</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="border-t p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
              {user?.user_metadata?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-8 w-8"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8" title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:pl-64">
        <div className="hidden md:flex h-16 items-center justify-end px-8 border-b bg-background/50 backdrop-blur-sm sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
