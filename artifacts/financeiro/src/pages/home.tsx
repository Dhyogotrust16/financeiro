import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Users, Wallet, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 lg:px-8 h-20 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <Wallet className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">Sistema Financeiro</span>
        </div>
        <div className="flex gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" className="font-medium">
              Entrar
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button className="font-medium">
              Começar agora
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-20 lg:py-32 px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-foreground mb-8">
            Controle financeiro preciso para <br className="hidden lg:block" />
            <span className="text-primary">contadores e escritórios</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-12">
            Gerencie honorários, reembolsos de despesas, faturamento de clientes e acompanhe a lucratividade do seu escritório em um único lugar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg">
                Criar conta gratuitamente
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg">
                Acessar painel
              </Button>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-muted/30 border-t">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="bg-background p-8 rounded-2xl border shadow-sm">
                <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <Users className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Gestão de Clientes</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Controle honorários mensais e despesas repassadas para cada cliente de forma organizada e transparente.
                </p>
              </div>
              <div className="bg-background p-8 rounded-2xl border shadow-sm">
                <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <BarChart3 className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Relatórios Precisos</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Acompanhe a lucratividade por cliente, fluxo de caixa e inadimplência com gráficos claros e objetivos.
                </p>
              </div>
              <div className="bg-background p-8 rounded-2xl border shadow-sm">
                <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Faturamento Simples</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Gere fechamentos mensais consolidando honorários e reembolsos em uma única cobrança.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 px-6 lg:px-8 bg-background">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 opacity-80">
            <Wallet className="h-5 w-5" />
            <span className="font-semibold">Sistema Financeiro</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Sistema Financeiro. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}