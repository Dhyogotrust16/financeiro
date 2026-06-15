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

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Clientes", href: "/clientes", icon: Users },
  { title: "Receitas", href: "/receitas", icon: ArrowDownToLine },
  { title: "Despesas", href: "/despesas", icon: ArrowUpToLine },
  { title: "Cobranças", href: "/cobrancas", icon: Receipt },
  { title: "Contas a Receber", href: "/contas-receber", icon: Wallet },
  { title: "Contas a Pagar", href: "/contas-pagar", icon: ArrowRightLeft },
  { title: "Relatórios", href: "/relatorios", icon: FileText },
  { title: "Categorias", href: "/categorias", icon: Tags },
];

const whatsappSubItems = [
  { title: "Conexão", href: "/whatsapp", icon: Wifi },
  { title: "Chat", href: "/whatsapp/chat", icon: MessageSquare },
  { title: "Métricas", href: "/whatsapp/dashboard", icon: BarChart2 },
];

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
              <item.icon className="h-5 w-5" />
              {item.title}
            </span>
          </Link>
        );
      })}

      {/* WhatsApp with submenu */}
      <div>
        <button
          onClick={() => setWppOpen(v => !v)}
          className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
            isWhatsAppActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <MessageCircle className="h-5 w-5" />
          <span className="flex-1 text-left">WhatsApp</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${wppOpen ? "rotate-180" : ""}`} />
        </button>
        {wppOpen && (
          <div className="mt-1 ml-4 space-y-1 border-l border-border pl-3">
            {whatsappSubItems.map(item => {
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
                    <item.icon className="h-4 w-4" />
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
