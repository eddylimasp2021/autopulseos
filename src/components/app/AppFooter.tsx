import { Zap } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-sidebar-border bg-sidebar/50 backdrop-blur-sm px-6 py-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="grid h-5 w-5 place-items-center rounded-md bg-[image:var(--gradient-neon)]">
            <Zap className="h-3 w-3 text-neon-foreground" />
          </div>
          <span>
            ©2026 Eddylima Informática Brasil eddylimainformatica@gmail.com — Todos os direitos reservados
          </span>
        </div>
        <span className="font-medium text-foreground/70">
          Eddylima Informática Soluções em T.I
        </span>
      </div>
    </footer>
  );
}
