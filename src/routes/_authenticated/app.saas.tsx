import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Users, Building, CreditCard, Search, Edit3, Calendar,
  AlertTriangle, Lock, Unlock, ArrowUpRight, HelpCircle, Loader2, CheckCircle2,
  Trash2, Save, Server, Webhook, Wallet, CheckCircle, Zap, MonitorPlay
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listWorkshopsAdmin, updateWorkshopPlanAdmin, getSaasConfigAdmin, updateSaasConfigAdmin, generateSupportLink } from "@/lib/saas.functions";

export const Route = createFileRoute("/_authenticated/app/saas")({ component: Page });

interface WorkshopAdmin {
  id: string;
  name: string;
  slug: string;
  plan: "trial" | "basico" | "profissional" | "premium";
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
  cnpj: string | null;
  support_enabled: boolean;
  owner_name: string;
  owner_email: string;
}

const planBadges: Record<string, { label: string; className: string }> = {
  trial: { label: "Trial/Testes", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  basico: { label: "Plano Básico", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  profissional: { label: "Profissional", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  premium: { label: "Plano Premium", className: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
};

function Page() {
  const qc = useQueryClient();
  const getWorkshops = useServerFn(listWorkshopsAdmin);
  const updatePlan = useServerFn(updateWorkshopPlanAdmin);
  const genSupportLink = useServerFn(generateSupportLink);

  // Queries
  const { data: workshops = [], isLoading } = useQuery<WorkshopAdmin[]>({
    queryKey: ["admin-workshops"],
    queryFn: () => getWorkshops(),
  });

  const getSaasConfig = useServerFn(getSaasConfigAdmin);
  const updateSaasConfig = useServerFn(updateSaasConfigAdmin);

  const { data: saasConfig } = useQuery({
    queryKey: ["saas-config"],
    queryFn: () => getSaasConfig()
  });

  useEffect(() => {
    if (saasConfig) {
      setAsaasApiKey(saasConfig.asaas_api_key || "");
      setAsaasWebhookSecret(saasConfig.asaas_webhook_secret || "");
    }
  }, [saasConfig]);

  // State
  const [activeTab, setActiveTab] = useState<"clientes" | "gateway" | "suporte">("clientes");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<string>("all");
  
  // Saas Config State
  const [asaasApiKey, setAsaasApiKey] = useState("");
  const [asaasWebhookSecret, setAsaasWebhookSecret] = useState("");
  
  const [editOpen, setEditOpen] = useState(false);
  const [selectedWorkshop, setSelectedWorkshop] = useState<WorkshopAdmin | null>(null);
  const [newPlan, setNewPlan] = useState<"trial" | "basico" | "profissional" | "premium">("trial");
  const [trialEndsAt, setTrialEndsAt] = useState("");

  // Mutations
  const mUpdatePlan = useMutation({
    mutationFn: (payload: { workshop_id: string; plan: typeof newPlan; trial_ends_at?: string | null }) => 
      updatePlan({ data: payload }),
    onSuccess: () => {
      toast.success("Plano da oficina atualizado com sucesso!");
      qc.invalidateQueries({ queryKey: ["admin-workshops"] });
      setEditOpen(false);
    },
    onError: (err: any) => {
      toast.error(`Falha ao atualizar plano: ${err.message}`);
    }
  });

  const mUpdateConfig = useMutation({
    mutationFn: (payload: { asaas_api_key: string; asaas_webhook_secret: string }) => 
      updateSaasConfig({ data: payload }),
    onSuccess: () => {
      toast.success("Configurações do Gateway salvas!");
      qc.invalidateQueries({ queryKey: ["saas-config"] });
    },
    onError: (err: any) => {
      toast.error(`Falha ao salvar gateway: ${err.message}`);
    }
  });

  const mGenerateSupport = useMutation({
    mutationFn: (workshop_id: string) => genSupportLink({ data: { workshop_id } }),
    onSuccess: (res) => {
      window.open(res.action_link, "_blank");
    },
    onError: (err: any) => toast.error(err.message)
  });

  // Open plan edit dialog
  const handleOpenEdit = (w: WorkshopAdmin) => {
    setSelectedWorkshop(w);
    setNewPlan(w.plan);
    setTrialEndsAt(w.trial_ends_at ? w.trial_ends_at.slice(0, 10) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    setEditOpen(true);
  };

  // Quick Action: Block/Suspend access (sets plan to 'trial' and trial_ends_at to past)
  const handleBlockAccess = (w: WorkshopAdmin) => {
    const confirmBlock = window.confirm(`Deseja realmente bloquear/suspender o acesso da oficina "${w.name}"? O plano será redefinido para Trial expirado.`);
    if (confirmBlock) {
      mUpdatePlan.mutate({
        workshop_id: w.id,
        plan: "trial",
        trial_ends_at: "2000-01-01T00:00:00.000Z"
      });
    }
  };

  // Quick Action: Activate Professional Plan directly
  const handleQuickActivate = (w: WorkshopAdmin) => {
    const confirmActivate = window.confirm(`Deseja realmente ativar o Plano Profissional imediatamente para "${w.name}"?`);
    if (confirmActivate) {
      mUpdatePlan.mutate({
        workshop_id: w.id,
        plan: "profissional",
        trial_ends_at: null
      });
    }
  };

  // Quick Action: Change plan directly to a paid tier (basico/profissional/premium)
  const handleQuickChangePlan = (w: WorkshopAdmin, plan: "basico" | "profissional" | "premium") => {
    const planLabel = planBadges[plan]?.label || plan;
    if (window.confirm(`Alterar a oficina "${w.name}" para o ${planLabel}?`)) {
      mUpdatePlan.mutate({
        workshop_id: w.id,
        plan,
        trial_ends_at: null,
      });
    }
  };

  // Submits plan update
  const handleSubmitPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkshop) return;

    mUpdatePlan.mutate({
      workshop_id: selectedWorkshop.id,
      plan: newPlan,
      trial_ends_at: newPlan === "trial" ? new Date(trialEndsAt + "T23:59:59Z").toISOString() : null
    });
  };

  // Calculated stats
  const stats = useMemo(() => {
    const total = workshops.length;
    const trials = workshops.filter(w => w.plan === "trial").length;
    const paid = total - trials;
    
    // Check if trial is expired
    const now = new Date();
    const expiredTrials = workshops.filter(w => {
      if (w.plan !== "trial") return false;
      if (!w.trial_ends_at) return false;
      return new Date(w.trial_ends_at) < now;
    }).length;

    return { total, trials, paid, expiredTrials };
  }, [workshops]);

  // Filtered workshops
  const filteredWorkshops = useMemo(() => {
    return workshops.filter(w => {
      // Search text filter
      const matchesSearch = 
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.owner_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (w.cnpj ?? "").toLowerCase().includes(searchTerm.toLowerCase());

      // Plan type tab filter
      if (selectedPlanFilter === "all") return matchesSearch;
      if (selectedPlanFilter === "trial") return matchesSearch && w.plan === "trial";
      if (selectedPlanFilter === "paid") return matchesSearch && w.plan !== "trial";
      return matchesSearch && w.plan === selectedPlanFilter;
    });
  }, [workshops, searchTerm, selectedPlanFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 8 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 border border-primary/20">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Painel SaaS</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerenciamento administrativo de clientes, planos e acessos</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs self-start sm:self-auto">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_currentColor]" />
          <span className="text-muted-foreground">Console do Criador Ativo</span>
        </div>
      </motion.div>

      {/* KPI Cards */}
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/40">
        {[
          { key: "clientes" as const, label: "Clientes & Planos", icon: Users },
          { key: "gateway" as const, label: "Gateway de Pagamento", icon: Wallet },
          { key: "suporte" as const, label: "Dar Suporte (VNC)", icon: MonitorPlay },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition",
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>


      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total de Oficinas", value: stats.total, icon: Building, color: "text-primary" },
          { label: "Assinaturas Ativas (Pagas)", value: stats.paid, icon: CreditCard, color: "text-emerald-400" },
          { label: "Oficinas em Trial", value: stats.trials, icon: Users, color: "text-amber-400" },
          { label: "Trials Expirados", value: stats.expiredTrials, icon: AlertTriangle, color: "text-destructive" },
        ].map((k, idx) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="glass rounded-2xl p-5 relative overflow-hidden group hover:border-primary/20 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</div>
                <div className="mt-2 text-2xl font-semibold font-display">{k.value}</div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/80 border border-border/60">
                <k.icon className={cn("h-4 w-4", k.color)} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Panel Box */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary/40 border border-border/40 p-1 rounded-xl w-full sm:w-auto overflow-x-auto justify-start">
          <TabsTrigger value="clientes" className="gap-2 rounded-lg text-xs md:text-sm">
            <Building className="h-4 w-4" /> Oficinas e Clientes
          </TabsTrigger>
          <TabsTrigger value="gateway" className="gap-2 rounded-lg text-xs md:text-sm">
            <CreditCard className="h-4 w-4" /> Gateway de Pagamento
          </TabsTrigger>
          <TabsTrigger value="suporte" className="gap-2 rounded-lg text-xs md:text-sm">
            <MonitorPlay className="h-4 w-4" /> Acesso Remoto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suporte" className="glass rounded-2xl p-6 border border-border/40 space-y-4">
          <div className="flex flex-col gap-2 mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2"><MonitorPlay className="h-5 w-5 text-primary" /> Dar Suporte (VNC)</h2>
            <p className="text-sm text-muted-foreground">
              Acesse o dashboard de oficinas que liberaram o acesso para suporte. Ao clicar em acessar, você será logado na conta do cliente em uma nova aba.
            </p>
          </div>
          <div className="overflow-x-auto border border-border/40 rounded-xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/40 border-b border-border/40 text-muted-foreground text-left">
                  <th className="p-3.5 font-semibold">Oficina</th>
                  <th className="p-3.5 font-semibold">Proprietário</th>
                  <th className="p-3.5 font-semibold text-center">Status Suporte</th>
                  <th className="p-3.5 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {workshops.filter(w => w.support_enabled).map(w => (
                  <tr key={w.id} className="hover:bg-secondary/15 transition-colors">
                    <td className="p-3.5 font-medium">
                      <div className="text-foreground font-semibold">{w.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">/{w.slug}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="text-foreground">{w.owner_name}</div>
                      <div className="text-muted-foreground font-mono text-[10px]">{w.owner_email}</div>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-semibold uppercase tracking-wide">
                        <CheckCircle2 className="h-3 w-3" /> Liberado
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <Button
                        size="sm"
                        disabled={mGenerateSupport.isPending}
                        onClick={() => mGenerateSupport.mutate(w.id)}
                        className="h-8 px-3 text-[11px] gap-1.5 shadow-[0_0_15px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)] transition-all"
                      >
                        {mGenerateSupport.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MonitorPlay className="h-3 w-3" />}
                        Acessar Dashboard
                      </Button>
                    </td>
                  </tr>
                ))}
                {workshops.filter(w => w.support_enabled).length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-muted-foreground">
                      Nenhuma oficina com acesso de suporte liberado no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="clientes" className="glass rounded-2xl p-6 border border-border/40 space-y-4">
        {/* Search & Filter Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: "all", label: "Todas" },
              { key: "trial", label: "Apenas Trial" },
              { key: "paid", label: "Apenas Pagos" },
              { key: "basico", label: "Básico" },
              { key: "profissional", label: "Profissional" },
              { key: "premium", label: "Premium" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setSelectedPlanFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition",
                  selectedPlanFilter === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/40 text-muted-foreground hover:bg-secondary"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por Oficina, Dono, E-mail, CNPJ ou Slug..."
              className="pl-9 h-9 text-xs bg-secondary/30"
            />
          </div>
        </div>

        {/* Clients Table */}
        {isLoading ? (
          <div className="p-20 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Carregando lista de clientes do SaaS...</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-border/40 rounded-xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/40 border-b border-border/40 text-muted-foreground text-left">
                  <th className="p-3.5 font-semibold">Oficina / Slug</th>
                  <th className="p-3.5 font-semibold">Proprietário / E-mail</th>
                  <th className="p-3.5 font-semibold">CNPJ</th>
                  <th className="p-3.5 font-semibold">Plano</th>
                  <th className="p-3.5 font-semibold">Status / Trial Ends</th>
                  <th className="p-3.5 font-semibold">Data Cadastro</th>
                  <th className="p-3.5 font-semibold text-right">Ações de Controle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredWorkshops.map(w => {
                  const now = new Date();
                  const trialEnds = w.trial_ends_at ? new Date(w.trial_ends_at) : null;
                  const isExpired = w.plan === "trial" && trialEnds && trialEnds < now;
                  
                  return (
                    <tr key={w.id} className="hover:bg-secondary/15 transition-colors">
                      <td className="p-3.5 font-medium">
                        <div className="text-foreground font-semibold">{w.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">/{w.slug}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="text-foreground">{w.owner_name}</div>
                        <div className="text-muted-foreground font-mono text-[10px]">{w.owner_email}</div>
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                        {w.cnpj || <span className="italic text-muted-foreground/60">—</span>}
                      </td>
                      <td className="p-3.5">
                        <span className={cn(
                          "px-2 py-0.5 rounded border text-[9px] font-semibold uppercase tracking-wide",
                          planBadges[w.plan]?.className || "bg-secondary text-muted-foreground"
                        )}>
                          {planBadges[w.plan]?.label || w.plan}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono">
                        {w.plan === "trial" ? (
                          isExpired ? (
                            <span className="text-destructive font-semibold">Expirado em {trialEnds?.toLocaleDateString("pt-BR")}</span>
                          ) : (
                            <span className="text-amber-400">Ativo até {trialEnds?.toLocaleDateString("pt-BR")}</span>
                          )
                        ) : (
                          <span className="text-emerald-400 font-semibold">Sem expiração (Ativo)</span>
                        )}
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        {new Date(w.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {(["basico", "profissional", "premium"] as const).map(p => (
                            <Button
                              key={p}
                              size="sm"
                              variant="outline"
                              disabled={w.plan === p || mUpdatePlan.isPending}
                              onClick={() => handleQuickChangePlan(w, p)}
                              className={cn(
                                "h-7 px-2 text-[10px] capitalize",
                                w.plan === p
                                  ? "border-primary/40 text-primary bg-primary/5"
                                  : "hover:border-primary/40"
                              )}
                              title={`Ativar ${planBadges[p].label}`}
                            >
                              {p === "basico" ? "Básico" : p === "profissional" ? "Profissional" : "Premium"}
                            </Button>
                          ))}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEdit(w)}
                            className="h-7 px-2 text-[10px] gap-1 hover:border-primary/40"
                            title="Abrir edição avançada"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>

                          {!(w.plan === "trial" && isExpired) ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleBlockAccess(w)}
                              disabled={mUpdatePlan.isPending}
                              className="h-7 px-2 text-[10px] gap-1 bg-red-950/40 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white"
                              title="Pausar / bloquear acesso"
                            >
                              <Lock className="h-3 w-3" /> Pausar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuickActivate(w)}
                              disabled={mUpdatePlan.isPending}
                              className="h-7 px-2 text-[10px] gap-1 text-emerald-400 hover:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/10"
                              title="Reativar acesso"
                            >
                              <Unlock className="h-3 w-3" /> Reativar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredWorkshops.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-muted-foreground">
                      Nenhuma oficina localizada com os filtros fornecidos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        </TabsContent>

        <TabsContent value="gateway" className="mt-0">
          <div className="glass rounded-2xl p-6 border border-border/40 space-y-6 max-w-3xl">
            <div>
              <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" /> Gateway de Pagamento (Asaas)
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure as chaves da API do Asaas para permitir que o AutoPulseOS identifique pagamentos aprovados e libere as oficinas automaticamente via Webhook.
              </p>
            </div>

            <div className="space-y-4 bg-secondary/20 p-5 rounded-xl border border-border/50">
              <div className="space-y-2">
                <Label htmlFor="asaas_api_key" className="text-sm font-semibold">Asaas API Key ($aact_...)</Label>
                <Input 
                  id="asaas_api_key" 
                  value={asaasApiKey} 
                  onChange={e => setAsaasApiKey(e.target.value)} 
                  placeholder="Insira a chave de API do Asaas..." 
                  className="font-mono text-xs bg-secondary/40"
                />
                <p className="text-[10px] text-muted-foreground">Esta chave será usada pelo AutoPulseOS para enviar ordens e criar assinaturas (futuramente).</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="asaas_webhook_secret" className="text-sm font-semibold">Webhook Access Token / Secret</Label>
                <Input 
                  id="asaas_webhook_secret" 
                  value={asaasWebhookSecret} 
                  onChange={e => setAsaasWebhookSecret(e.target.value)} 
                  placeholder="Insira o Token de acesso do Webhook..." 
                  className="font-mono text-xs bg-secondary/40"
                />
                <p className="text-[10px] text-muted-foreground">Token usado para validar se a requisição do webhook veio realmente do Asaas.</p>
              </div>

              <div className="pt-4 flex justify-end">
                <Button 
                  onClick={() => mUpdateConfig.mutate({ asaas_api_key: asaasApiKey, asaas_webhook_secret: asaasWebhookSecret })}
                  disabled={mUpdateConfig.isPending}
                >
                  {mUpdateConfig.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Gateway
                </Button>
              </div>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-3">
              <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                <Server className="h-4 w-4" /> Configuração do Webhook no Asaas
              </h3>
              <p className="text-xs text-blue-400/80 leading-relaxed">
                No painel do Asaas, acesse <strong>Minha Conta &gt; Integração &gt; Webhooks</strong> e crie um webhook para <strong>Cobranças</strong>. Utilize a URL abaixo. Ative os eventos de <em>Pagamento Confirmado/Recebido</em>. O Access Token que o Asaas gerar deve ser colado no campo acima.
              </p>
              <div className="bg-background/50 p-2 rounded border border-blue-500/20 font-mono text-xs text-foreground flex justify-between items-center">
                <span className="select-all">https://sua-url-do-sistema.com/api/public/webhooks/payment</span>
              </div>
            </div>

          </div>
        </TabsContent>
      </Tabs>

      {/* Plan Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="glass border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Edit3 className="h-5 w-5 text-primary" /> Alterar Assinatura do Cliente
            </DialogTitle>
          </DialogHeader>
          {selectedWorkshop && (
            <form onSubmit={handleSubmitPlan} className="space-y-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Oficina selecionada</div>
                <div className="font-semibold text-sm text-foreground">{selectedWorkshop.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono">Dono: {selectedWorkshop.owner_name} ({selectedWorkshop.owner_email})</div>
              </div>

              {/* Plan Selection */}
              <div className="space-y-2">
                <Label htmlFor="plan-select" className="text-xs font-semibold">Selecione o Plano da Assinatura</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "trial" as const, label: "Trial / Testes" },
                    { key: "basico" as const, label: "Plano Básico" },
                    { key: "profissional" as const, label: "Profissional" },
                    { key: "premium" as const, label: "Plano Premium" },
                  ].map(p => (
                    <button
                      type="button"
                      key={p.key}
                      onClick={() => setNewPlan(p.key)}
                      className={cn(
                        "p-3 rounded-xl border text-xs font-semibold text-center transition flex flex-col items-center justify-center gap-1.5",
                        newPlan === p.key 
                          ? "bg-primary/10 border-primary text-primary" 
                          : "bg-secondary/40 border-border/50 text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trial Date Field */}
              {newPlan === "trial" && (
                <div className="space-y-2">
                  <Label htmlFor="trial-date" className="text-xs font-semibold">Término do Período de Testes (Trial)</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="trial-date"
                      type="date"
                      value={trialEndsAt}
                      onChange={e => setTrialEndsAt(e.target.value)}
                      className="pl-9 bg-secondary/30 text-xs"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Ao atingir esta data, o acesso do cliente será automaticamente suspenso até que ele adquira um plano.
                  </p>
                </div>
              )}

              {newPlan !== "trial" && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[10px] leading-relaxed">
                  <strong>Aviso:</strong> A ativação de um plano pago remove o controle de data do Trial. O cliente terá acesso contínuo e ilimitado às funcionalidades contratadas.
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditOpen(false)}
                  disabled={mUpdatePlan.isPending}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={mUpdatePlan.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                >
                  {mUpdatePlan.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


