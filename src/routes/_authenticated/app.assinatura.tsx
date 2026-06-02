import { createFileRoute } from "@tanstack/react-router";
import { Star, ShieldCheck, CheckCircle2, AlertTriangle, ExternalLink, Loader2, ArrowRight } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkshop } from "@/lib/configuracoes.functions";
import { generateAsaasPaymentLink } from "@/lib/assinaturas.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/assinatura")({
  component: Page,
});

function Page() {
  const fnGetW = useServerFn(getWorkshop);
  const fnGenerateLink = useServerFn(generateAsaasPaymentLink);

  const { data: workshop, isLoading } = useQuery({
    queryKey: ["workshop-plan"],
    queryFn: () => fnGetW(),
  });

  const mGenerateLink = useMutation({
    mutationFn: () => fnGenerateLink(),
    onSuccess: (data) => {
      // Abre o link em nova aba
      window.open(data.url, "_blank");
      toast.success("Fatura gerada com sucesso! Você foi redirecionado para a página de pagamento.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao gerar cobrança.");
    }
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isTrial = workshop?.plan === "trial";
  const now = new Date();
  const trialEnds = workshop?.trial_ends_at ? new Date(workshop.trial_ends_at) : null;
  
  let diasRestantes = 0;
  if (trialEnds) {
    diasRestantes = Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }
  const isExpired = isTrial && diasRestantes === 0;

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-neon)] text-white shadow-lg">
          <Star className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meu Plano</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie sua assinatura e acesso aos recursos da plataforma.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl">
        {/* Status Card */}
        <div className="glass rounded-3xl p-8 border border-border/40 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <ShieldCheck className="h-40 w-40" />
          </div>
          
          <div className="space-y-6 relative z-10">
            <div>
              <h2 className="text-lg font-semibold text-muted-foreground">Status Atual</h2>
              <div className="mt-2 text-4xl font-display font-bold">
                {isTrial ? "Plano Trial" : `Plano ${workshop?.plan.charAt(0).toUpperCase()}${workshop?.plan.slice(1)}`}
              </div>
            </div>

            {isTrial && (
              <div className="space-y-2">
                <div className={`text-sm font-medium flex items-center gap-2 ${isExpired ? 'text-destructive' : 'text-emerald-500'}`}>
                  {isExpired ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isExpired ? "Seu período de testes expirou." : `Você ainda tem ${diasRestantes} dias de teste gratuito.`}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Para continuar utilizando todos os recursos sem interrupções, faça o upgrade para o Plano Profissional.
                </p>
              </div>
            )}

            {!isTrial && (
              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" /> Assinatura Ativa
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sua oficina possui acesso ilimitado a todos os módulos do sistema. O faturamento é realizado via Asaas.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Upgrade Card */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl p-8 border border-primary/20 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
          
          <div className="space-y-2 relative z-10">
            <h2 className="text-2xl font-bold">Plano Profissional</h2>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">R$ 350</span>
              <span className="text-sm text-muted-foreground font-medium">/mês</span>
            </div>
          </div>

          <ul className="space-y-3 relative z-10 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Acesso ilimitado a Ordens de Serviço</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Controle de Estoque e PDV</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Módulo Financeiro e Fiscal</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Integração WhatsApp (em breve)</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Suporte Prioritário</li>
          </ul>

          <div className="pt-4 relative z-10">
            {isTrial ? (
              <Button 
                size="lg" 
                className="w-full text-base font-semibold shadow-lg shadow-primary/25 h-14"
                onClick={() => mGenerateLink.mutate()}
                disabled={mGenerateLink.isPending}
              >
                {mGenerateLink.isPending ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <>Assinar Agora <ArrowRight className="h-5 w-5 ml-2" /></>
                )}
              </Button>
            ) : (
              <Button size="lg" variant="outline" className="w-full h-14" disabled>
                Plano já ativo
              </Button>
            )}
            
            {isTrial && (
              <p className="text-[10px] text-center text-muted-foreground mt-3 flex items-center justify-center gap-1">
                Pagamento seguro processado via Asaas <ExternalLink className="h-3 w-3" />
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
