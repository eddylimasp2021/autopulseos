import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Car, ClipboardList, Droplet, Package,
  ShoppingCart, Wallet, BarChart3, Calendar, MessageCircle, Settings, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };
const items: Item[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/clientes", label: "Clientes", icon: Users },
  { to: "/app/veiculos", label: "Veículos", icon: Car },
  { to: "/app/ordens", label: "Ordens de Serviço", icon: ClipboardList },
  { to: "/app/troca-oleo", label: "Troca de Óleo", icon: Droplet },
  { to: "/app/estoque", label: "Estoque", icon: Package },
  { to: "/app/pdv", label: "PDV", icon: ShoppingCart },
  { to: "/app/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/app/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/app/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
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
        <div className="font-display text-sm font-semibold text-foreground">Trial · 14 dias</div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-[35%] rounded-full bg-[image:var(--gradient-neon)]" />
        </div>
      </div>
    </aside>
  );
}