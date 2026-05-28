import { Bell, Search, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export function Topbar({ userName }: { userName?: string }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/60 glass-strong px-6">
      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar clientes, veículos, OS..." className="pl-9 bg-secondary/50 border-border/60" />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_currentColor]" />
        </Button>
        <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-border/60">
          <div className="text-right">
            <div className="text-sm font-medium leading-none">{userName ?? "Usuário"}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Owner</div>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[image:var(--gradient-neon)] text-sm font-semibold text-neon-foreground">
            {(userName ?? "U").charAt(0).toUpperCase()}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}