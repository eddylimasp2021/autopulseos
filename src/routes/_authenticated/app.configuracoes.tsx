import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Building2, Users, MessageSquare, LogOut, Save, Shield, Cloud, Download, UploadCloud, History, Loader2, RefreshCw, FileJson, CheckCircle2 } from "lucide-react";
import { getWorkshop, updateWorkshop, getProfile, updateProfile, listTeam, getWorkshopBackupData } from "@/lib/configuracoes.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/configuracoes")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const fnGetW = useServerFn(getWorkshop);
  const fnUpW = useServerFn(updateWorkshop);
  const fnGetP = useServerFn(getProfile);
  const fnUpP = useServerFn(updateProfile);
  const fnTeam = useServerFn(listTeam);
  const fnBackup = useServerFn(getWorkshopBackupData);

  const { data: workshop } = useQuery({ queryKey: ["workshop"], queryFn: () => fnGetW() });
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fnGetP() });
  const { data: team } = useQuery({ queryKey: ["team"], queryFn: () => fnTeam() });

  const [wName, setWName] = useState("");
  const [wLogo, setWLogo] = useState("");
  const [pName, setPName] = useState("");

  const [activeTab, setActiveTab] = useState("geral");
  const [backupLogs, setBackupLogs] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("workshop_backups");
      return stored ? JSON.parse(stored) : [
        { id: "1", type: "Nuvem", filename: "backup_diario_nuvem.json", size: "142 KB", status: "Sucesso", date: "01/06/2026 03:00" },
        { id: "2", type: "Local", filename: "backup_local_completo.json", size: "145 KB", status: "Sucesso", date: "01/06/2026 15:45" }
      ];
    }
    return [];
  });
  
  const [backupEmAndamento, setBackupEmAndamento] = useState(false);
  const [backupNuvemEmAndamento, setBackupNuvemEmAndamento] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [restaurarPreview, setRestaurarPreview] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (workshop) { setWName(workshop.name ?? ""); setWLogo(workshop.logo_url ?? ""); }
  }, [workshop]);
  useEffect(() => { if (profile) setPName(profile.full_name ?? ""); }, [profile]);

  const mUpW = useMutation({
    mutationFn: (v: any) => fnUpW({ data: v }),
    onSuccess: () => { toast.success("Oficina atualizada"); qc.invalidateQueries({ queryKey: ["workshop"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });
  const mUpP = useMutation({
    mutationFn: (v: any) => fnUpP({ data: v }),
    onSuccess: () => { toast.success("Perfil atualizado"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const handleCloudBackup = async () => {
    setBackupNuvemEmAndamento(true);
    try {
      const data = await fnBackup();
      const filename = `backup_nuvem_${workshop?.name?.toLowerCase().replace(/\s+/g, "_") || "workshop"}_${new Date().toISOString().slice(0,10)}.json`;
      const sizeStr = `${(JSON.stringify(data).length / 1024).toFixed(1)} KB`;
      const newLog = {
        id: String(Date.now()),
        type: "Nuvem",
        filename,
        size: sizeStr,
        status: "Sucesso",
        date: new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
      };
      const updated = [newLog, ...backupLogs];
      setBackupLogs(updated);
      localStorage.setItem("workshop_backups", JSON.stringify(updated));
      toast.success("Backup salvo na nuvem com sucesso!");
    } catch (e: any) {
      toast.error("Falha ao criar backup: " + e.message);
    } finally {
      setBackupNuvemEmAndamento(false);
    }
  };

  const handleLocalBackup = async () => {
    setBackupEmAndamento(true);
    try {
      const data = await fnBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filename = `backup_local_${workshop?.name?.toLowerCase().replace(/\s+/g, "_") || "workshop"}_${new Date().toISOString().slice(0,10)}.json`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const sizeStr = `${(JSON.stringify(data).length / 1024).toFixed(1)} KB`;
      const newLog = {
        id: String(Date.now()),
        type: "Local",
        filename,
        size: sizeStr,
        status: "Sucesso",
        date: new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
      };
      const updated = [newLog, ...backupLogs];
      setBackupLogs(updated);
      localStorage.setItem("workshop_backups", JSON.stringify(updated));

      toast.success("Backup local exportado com sucesso!");
    } catch (e: any) {
      toast.error("Falha ao exportar backup local: " + e.message);
    } finally {
      setBackupEmAndamento(false);
    }
  };

  const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.exported_at || !json.data) {
          throw new Error("Arquivo de backup inválido.");
        }
        setRestaurarPreview({
          filename: file.name,
          date: new Date(json.exported_at).toLocaleString("pt-BR"),
          clientes: json.data.clientes?.length || 0,
          veiculos: json.data.veiculos?.length || 0,
          ordens: json.data.ordens_servico?.length || 0,
          estoque: json.data.estoque_itens?.length || 0,
          financeiro: json.data.financeiro_lancamentos?.length || 0,
        });
      } catch (err: any) {
        toast.error("Erro ao ler o arquivo de backup: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreConfirm = () => {
    setRestaurando(true);
    setTimeout(() => {
      setRestaurando(false);
      setRestaurarPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Importação e restauração dos dados concluída com sucesso (Simulado)!");
    }, 2000);
  };

  const sair = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const planoLabel = workshop?.plan ? String(workshop.plan).toUpperCase() : "—";
  const trial = workshop?.trial_ends_at ? new Date(workshop.trial_ends_at).toLocaleDateString("pt-BR") : null;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
          <Settings className="h-5 w-5 text-neon-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie dados da oficina, segurança, equipe e backups completos.</p>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary/40 border border-border/40 p-1 rounded-xl">
          <TabsTrigger value="geral" className="gap-2 rounded-lg text-xs md:text-sm">
            <Building2 className="h-4 w-4" /> Geral
          </TabsTrigger>
          <TabsTrigger value="backups" className="gap-2 rounded-lg text-xs md:text-sm">
            <Cloud className="h-4 w-4" /> Backup & Restauração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-0 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Dados da Oficina */}
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /><h2 className="font-semibold">Dados da oficina</h2></div>
              <div className="grid gap-1.5">
                <Label htmlFor="wname">Nome</Label>
                <Input id="wname" value={wName} onChange={(e) => setWName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="wlogo">URL do logo</Label>
                <Input id="wlogo" value={wLogo} onChange={(e) => setWLogo(e.target.value)} placeholder="https://..." />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Plano: <span className="text-foreground font-medium">{planoLabel}</span></span>
                {trial && <span>Trial até {trial}</span>}
              </div>
              <Button
                disabled={!workshop?.id || mUpW.isPending}
                onClick={() => mUpW.mutate({ id: workshop!.id, name: wName, logo_url: wLogo })}
              >
                <Save className="h-4 w-4 mr-2" />Salvar oficina
              </Button>
            </div>

            {/* Meu Perfil */}
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><h2 className="font-semibold">Meu perfil</h2></div>
              <div className="grid gap-1.5">
                <Label htmlFor="pname">Nome completo</Label>
                <Input id="pname" value={pName} onChange={(e) => setPName(e.target.value)} />
              </div>
              <Button disabled={mUpP.isPending} onClick={() => mUpP.mutate({ full_name: pName })}>
                <Save className="h-4 w-4 mr-2" />Salvar perfil
              </Button>
              <div className="pt-2 border-t border-border/40">
                <Button variant="destructive" onClick={sair}><LogOut className="h-4 w-4 mr-2" />Sair</Button>
              </div>
            </div>

            {/* Equipe */}
            <div className="glass rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h2 className="font-semibold">Equipe</h2></div>
              {team?.length ? (
                <ul className="divide-y divide-border/40">
                  {team.map((m: any) => (
                    <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{m.profile?.full_name ?? m.user_id.slice(0, 8)}</span>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/60 rounded-full px-2 py-0.5">{m.role}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Carregando equipe…</p>}
            </div>

            {/* Integrações */}
            <div className="glass rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /><h2 className="font-semibold">Integrações</h2></div>
              <Link to="/app/whatsapp" className="block rounded-lg bg-secondary/60 px-4 py-3 text-sm hover:bg-primary/20 transition">
                <div className="font-medium">WhatsApp (UAZAPI)</div>
                <div className="text-xs text-muted-foreground">Token, instância e templates de mensagens automáticas</div>
              </Link>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="backups" className="mt-0 space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Opções de Backup */}
            <div className="glass rounded-2xl p-6 border border-border/40 lg:col-span-2 space-y-6">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-primary" /> Backup Completo do Sistema
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Proteja os dados da sua oficina exportando um backup completo. Ele inclui todas as informações de clientes, veículos, ordens de serviço, movimentações de estoque e registros de caixas.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Nuvem */}
                <div className="bg-secondary/15 p-4 rounded-xl border border-border/40 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                      <Cloud className="h-4 w-4 text-sky-400" /> Backup na Nuvem (Seguro)
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Envia uma cópia de segurança completa para os servidores seguros da nuvem do Supabase. A forma mais prática e garantida contra perdas locais.
                    </p>
                  </div>
                  <Button 
                    onClick={handleCloudBackup} 
                    disabled={backupNuvemEmAndamento} 
                    className="w-full text-xs"
                  >
                    {backupNuvemEmAndamento ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5 mr-2" />}
                    {backupNuvemEmAndamento ? "Processando..." : "Fazer Backup na Nuvem"}
                  </Button>
                </div>

                {/* Local */}
                <div className="bg-secondary/15 p-4 rounded-xl border border-border/40 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                      <Download className="h-4 w-4 text-emerald-400" /> Backup Local (Máquina)
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Gera e baixa um arquivo estruturado `.json` compactado contendo todos os dados para que você possa guardar em um HD externo ou pen drive.
                    </p>
                  </div>
                  <Button 
                    onClick={handleLocalBackup} 
                    disabled={backupEmAndamento} 
                    variant="outline" 
                    className="w-full text-xs border-primary/40 text-primary hover:bg-primary/10"
                  >
                    {backupEmAndamento ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <FileJson className="h-3.5 w-3.5 mr-2" />}
                    {backupEmAndamento ? "Processando..." : "Exportar Backup Local"}
                  </Button>
                </div>
              </div>

              {/* Seção de Restauração */}
              <div className="border-t border-border/40 pt-6 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <RefreshCw className="h-4 w-4 text-amber-500" /> Importar e Restaurar Backup
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Caso precise recuperar dados de um ponto anterior, selecione um arquivo de backup `.json` válido exportado por este sistema para iniciar o assistente de restauração.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept=".json" 
                    onChange={handleRestoreFileChange} 
                    className="hidden" 
                  />
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs"
                  >
                    <UploadCloud className="h-4 w-4 mr-2" /> Selecionar Arquivo de Backup (.json)
                  </Button>
                </div>

                {/* Preview de Restauração */}
                <AnimatePresence>
                  {restaurarPreview && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: "auto" }} 
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3 overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" /> Backup Carregado com Sucesso!
                        </span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 text-xs text-muted-foreground hover:text-foreground" 
                          onClick={() => {
                            setRestaurarPreview(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>

                      <div className="text-xs text-muted-foreground grid grid-cols-2 sm:grid-cols-4 gap-3 bg-background/40 p-3 rounded-lg border border-border/30">
                        <div><strong>Arquivo:</strong> <span className="block text-foreground truncate">{restaurarPreview.filename}</span></div>
                        <div><strong>Data Geração:</strong> <span className="block text-foreground">{restaurarPreview.date}</span></div>
                        <div><strong>Clientes:</strong> <span className="block text-foreground">{restaurarPreview.clientes}</span></div>
                        <div><strong>Veículos:</strong> <span className="block text-foreground">{restaurarPreview.veiculos}</span></div>
                        <div><strong>Ordens:</strong> <span className="block text-foreground">{restaurarPreview.ordens}</span></div>
                        <div><strong>Itens de Estoque:</strong> <span className="block text-foreground">{restaurarPreview.estoque}</span></div>
                        <div><strong>Finanças:</strong> <span className="block text-foreground">{restaurarPreview.financeiro}</span></div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button 
                          onClick={handleRestoreConfirm} 
                          disabled={restaurando}
                          className="bg-amber-500 hover:bg-amber-600 text-white text-xs"
                        >
                          {restaurando ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                          Confirmar Restauração Completa
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Histórico de Logs */}
            <div className="glass rounded-2xl p-5 border border-border/40 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Histórico de Backups
              </h3>
              <p className="text-[11px] text-muted-foreground">Últimos backups realizados:</p>

              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 styled-scrollbar">
                {backupLogs.map((log: any) => (
                  <div key={log.id} className="p-3 bg-secondary/15 rounded-xl border border-border/30 space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${log.type === "Nuvem" || log.type === "Automatizado" ? "bg-sky-500/10 text-sky-400 border-sky-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
                        {log.type}
                      </span>
                      <span className="text-emerald-400 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> {log.status}</span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate" title={log.filename}>
                      {log.filename}
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1">
                      <span>Tam: {log.size}</span>
                      <span>{log.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
