import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Car, ClipboardList, Droplet, Package,
  ShoppingCart, Wallet, BarChart3, Calendar, MessageCircle, Settings, Zap, Wrench,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkshop } from "@/lib/configuracoes.functions";

type Item = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };
const items: Item[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/clientes", label: "Clientes", icon: Users },
  { to: "/app/veiculos", label: "Veículos", icon: Car },
  { to: "/app/ordens", label: "Ordens de Serviço", icon: ClipboardList },
  { to: "/app/elevadores", label: "Elevadores", icon: Wrench },
  { to: "/app/troca-oleo", label: "Troca de Óleo", icon: Droplet },
  { to: "/app/estoque", label: "Estoque", icon: Package },
  { to: "/app/pdv", label: "PDV", icon: ShoppingCart },
  { to: "/app/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/app/fiscal", label: "Fiscal", icon: Receipt },
  { to: "/app/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/app/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const fnGetW = useServerFn(getWorkshop);
  const { data: workshop } = useQuery({ queryKey: ["workshop"], queryFn: () => fnGetW() });

  const plan = workshop?.plan || "trial";
  const isTrial = plan === "trial";
  
  const now = new Date();
  const trialEnds = workshop?.trial_ends_at ? new Date(workshop.trial_ends_at) : null;
  let diasRestantes = 0;
  if (trialEnds) {
    const diffTime = trialEnds.getTime() - now.getTime();
    diasRestantes = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  const percentage = isTrial ? Math.min(100, Math.max(0, (diasRestantes / 14) * 100)) : 100;

  const planNames: Record<string, string> = {
    trial: "Trial",
    basico: "Básico",
    profissional: "Profissional",
    premium: "Premium"
  };

  return (
    <aside className="hidden md:flex md:w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-neon)] neon-border">
          <Zap className="h-4 w-4 text-neon-foreground" />
        </div>
        <div>
          <div className="font-display text-sm font-semibold tracking-tight text-sidebar-foreground">
            Garagem<span className="neon-text">OS</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pro Edition</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {items.map((it) => {
          const active = it.end ? path === it.to : path === it.to || path.startsWith(it.to + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to as never}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.06)]"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4 transition-colors", active && "text-primary")} />
              <span>{it.label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-xl glass p-4">
        <div className="text-xs text-muted-foreground">Plano</div>
        <div className="font-display text-sm font-semibold text-foreground">
          {isTrial ? (
            diasRestantes > 0 ? `Trial · ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}` : "Trial · Expirado"
          ) : (
            `Plano ${planNames[plan] || plan}`
          )}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div 
            style={{ width: `${percentage}%` }}
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isTrial && diasRestantes <= 3 ? "bg-destructive shadow-[0_0_8px_currentColor]" : "bg-[image:var(--gradient-neon)]"
            )} 
          />
        </div>
        {isTrial && diasRestantes <= 3 && (
          <div className="mt-1.5 text-[9px] text-destructive font-medium animate-pulse">
            {diasRestantes === 0 ? "Sua avaliação terminou!" : "Seu trial está prestes a expirar!"}
          </div>
        )}
        {!isTrial && (
          <div className="mt-1 text-[9px] text-emerald-400 font-medium">
            Assinatura Ativa
          </div>
        )}
      </div>
    </aside>
  );
}