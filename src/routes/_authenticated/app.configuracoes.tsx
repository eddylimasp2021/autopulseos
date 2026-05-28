import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Building2, Users, MessageSquare, LogOut, Save, Shield } from "lucide-react";
import { getWorkshop, updateWorkshop, getProfile, updateProfile, listTeam } from "@/lib/configuracoes.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/configuracoes")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const fnGetW = useServerFn(getWorkshop);
  const fnUpW = useServerFn(updateWorkshop);
  const fnGetP = useServerFn(getProfile);
  const fnUpP = useServerFn(updateProfile);
  const fnTeam = useServerFn(listTeam);

  const { data: workshop } = useQuery({ queryKey: ["workshop"], queryFn: () => fnGetW() });
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fnGetP() });
  const { data: team } = useQuery({ queryKey: ["team"], queryFn: () => fnTeam() });

  const [wName, setWName] = useState("");
  const [wLogo, setWLogo] = useState("");
  const [pName, setPName] = useState("");

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
          <p className="text-sm text-muted-foreground mt-1">Oficina, perfil, equipe e integrações.</p>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
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

        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /><h2 className="font-semibold">Integrações</h2></div>
          <Link to="/app/whatsapp" className="block rounded-lg bg-secondary/60 px-4 py-3 text-sm hover:bg-primary/20 transition">
            <div className="font-medium">WhatsApp (UAZAPI)</div>
            <div className="text-xs text-muted-foreground">Token, instância e templates de mensagens automáticas</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
