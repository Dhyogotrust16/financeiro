import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/lib/auth";

import Home from "@/pages/home";
import SignIn from "@/pages/sign-in";
import SignUp from "@/pages/sign-up";
import Dashboard from "@/pages/dashboard";
import Clientes from "@/pages/clientes/index";
import ClienteDetail from "@/pages/clientes/[id]";
import Receitas from "@/pages/receitas";
import Despesas from "@/pages/despesas";
import Cobrancas from "@/pages/cobrancas";
import ContasReceber from "@/pages/contas-receber";
import ContasPagar from "@/pages/contas-pagar";
import Honorarios from "@/pages/honorarios";
import Relatorios from "@/pages/relatorios";
import Categorias from "@/pages/categorias";
import Configuracao from "@/pages/configuracao";
import Socio from "@/pages/socio";
import WhatsApp from "@/pages/whatsapp";
import WhatsAppChat from "@/pages/whatsapp-chat";
import WhatsAppDashboard from "@/pages/whatsapp-dashboard";
import NotFound from "@/pages/not-found";
import Shell from "@/components/layout/Shell";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;

  if (!isSignedIn) return <Redirect to="/sign-in" />;

  return (
    <Shell>
      <Component />
    </Shell>
  );
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <Home />;
}

function AppRoutes() {
  const { isLoaded } = useAuth();

  // Don't render routes until auth is resolved — prevents queries firing without token
  if (!isLoaded) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );

  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in" component={SignIn} />
      <Route path="/sign-up" component={SignUp} />

      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/clientes" component={() => <ProtectedRoute component={Clientes} />} />
      <Route path="/clientes/:id" component={() => <ProtectedRoute component={ClienteDetail} />} />
      <Route path="/receitas" component={() => <ProtectedRoute component={Receitas} />} />
      <Route path="/despesas" component={() => <ProtectedRoute component={Despesas} />} />
      <Route path="/cobrancas" component={() => <ProtectedRoute component={Cobrancas} />} />
      <Route path="/contas-receber" component={() => <ProtectedRoute component={ContasReceber} />} />
      <Route path="/contas-pagar" component={() => <ProtectedRoute component={ContasPagar} />} />
      <Route path="/honorarios" component={() => <ProtectedRoute component={Honorarios} />} />
      <Route path="/relatorios" component={() => <ProtectedRoute component={Relatorios} />} />
      <Route path="/categorias" component={() => <ProtectedRoute component={Categorias} />} />
      <Route path="/socio" component={() => <ProtectedRoute component={Socio} />} />
      <Route path="/configuracao" component={() => <ProtectedRoute component={Configuracao} />} />
      <Route path="/whatsapp" component={() => <ProtectedRoute component={WhatsApp} />} />
      <Route path="/whatsapp/chat" component={() => <ProtectedRoute component={WhatsAppChat} />} />
      <Route path="/whatsapp/dashboard" component={() => <ProtectedRoute component={WhatsAppDashboard} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="financeiro-theme">
      <TooltipProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <WouterRouter base={basePath}>
              <AppRoutes />
            </WouterRouter>
            <Toaster />
          </QueryClientProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
