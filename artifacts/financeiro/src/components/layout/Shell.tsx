import { Link, useLocation } from "wouter";
import { UserButton, useUser } from "@clerk/react";
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
  ArrowUpToLine
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

export default function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user } = useUser();

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
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
    </nav>
  );

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
        <div className="flex items-center gap-2">
          <UserButton />
        </div>
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
          <div className="flex items-center gap-3">
            <UserButton />
            <span className="text-sm font-medium truncate max-w-[120px]">
              {user?.firstName || user?.username || 'Usuário'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-9 w-9"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:pl-64">
        {/* Desktop Topbar for extra actions if needed, currently just holding theme toggle */}
        <div className="hidden md:flex h-16 items-center justify-end px-8 border-b bg-background/50 backdrop-blur-sm sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="hidden md:flex"
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