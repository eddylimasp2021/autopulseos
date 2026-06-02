import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState, Link } from "@tanstack/react-router";
import { getWorkshop } from "@/lib/configuracoes.functions";
import { Lock, ArrowRight, ShieldAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubscriptionGuard({ children, isCreator }: { children: React.ReactNode; isCreator?: boolean }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const fnGetW = useServerFn(getWorkshop);

  const { data: workshop, isLoading } = useQuery({
    queryKey: ["workshop-plan"],
    queryFn: () => fnGetW(),
  });

  // Rotas que sempre ficam liberadas (mesmo com o plano expirado)
  const allowedRoutes = ["/app/assinatura", "/app/configuracoes", "/app/saas"];
  
  if (isLoading) {
    // Para evitar flicker, só mostra os filhos ou nada enquanto carrega
    return <>{children}</>;
  }

  // O criador sempre tem acesso livre
  if (isCreator) {
    return <>{children}</>;
  }

  const isTrial = workshop?.plan === "trial";
  let isExpired = false;

  if (isTrial && workshop?.trial_ends_at) {
    const trialEnds = new Date(workshop.trial_ends_at);
    // Adiciona 1 dia de tolerância (24h extras)
    trialEnds.setDate(trialEnds.getDate() + 1);
    const now = new Date();
    
    if (now > trialEnds) {
      isExpired = true;
    }
  }

  // Se a rota for permitida, renderiza o children normal
  const isAllowedPath = allowedRoutes.some((route) => path === route || path.startsWith(route + "/"));
  
  if (!isExpired || isAllowedPath) {
    return <>{children}</>;
  }

  // Tela de Bloqueio (Lock Screen)
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="glass rounded-3xl p-8 md:p-12 border border-destructive/20 max-w-xl w-full text-center space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <ShieldAlert className="h-40 w-40 text-destructive" />
        </div>
        
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive shadow-inner mb-2 relative z-10">
          <Lock className="h-10 w-10" />
        </div>
        
        <div className="space-y-2 relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Acesso Bloqueado</h1>
          <p className="text-muted-foreground">
            O período de testes da sua oficina expirou. Para continuar utilizando os recursos do AutoPulseOS e não perder seus dados, assine o Plano Profissional.
          </p>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-left relative z-10 mt-6 mb-6 flex flex-col sm:flex-row gap-4 items-center">
           <div className="bg-[image:var(--gradient-neon)] rounded-full p-3 shadow-[0_0_15px_oklch(0.6_0.25_140)]">
             <Zap className="h-6 w-6 text-white" />
           </div>
           <div>
             <h3 className="font-semibold text-lg text-foreground">Acesse "Meu Plano"</h3>
             <p className="text-sm text-muted-foreground mt-1">Lá você pode gerar sua fatura e reativar o sistema imediatamente após o pagamento.</p>
           </div>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/app/assinatura" className="w-full sm:w-auto">
            <Button size="lg" className="w-full text-base h-14 shadow-lg shadow-primary/25">
              Ir para Assinaturas <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
