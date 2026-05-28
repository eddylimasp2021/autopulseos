import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageCircle, Bot, Settings2, CheckCircle2, Clock, AlertCircle, ToggleLeft, ToggleRight, Save } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { listMensagens, getConfig, upsertConfig } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/app/whatsapp")({ component: Page });

type Msg = { id: string; telefone: string; mensagem: string; evento: string | null; status: string; enviado_em: string | null; erro: string | null; tentativas: number; created_at: string };

const statusIcon: Record<string, ReactNode> = {
  enviado: <CheckCircle2 className="h-3 w-3 text-success" />,
  pendente: <Clock className="h-3 w-3 text-warning" />,
  erro: <AlertCircle className="h-3 w-3 text-destructive" />,
};

function Page() {
  const [aba, setAba] = useState<"mensagens" | "config">("mensagens");
  const qc = useQueryClient();

  const listMsgs = useServerFn(listMensagens);
  const getCfg = useServerFn(getConfig);
  const upsert = useServerFn(upsertConfig);

  const { data: msgs = [], isLoading } = useQuery({ queryKey: ["wa-msgs"], queryFn: () => listMsgs() });
  const { data: cfg } = useQuery({ queryKey: ["wa-config"], queryFn: () => getCfg() });

  const [form, setForm] = useState({
    ativo: false, instance_url: "", token: "",
    template_os_concluida: "", template_os_entregue: "",
    template_lembrete_oleo: "", template_cobranca: "",
  });

  useEffect(() => {
    if (cfg) setForm({
      ativo: !!(cfg as any).ativo,
      instance_url: (cfg as any).instance_url ?? "",
      token: (cfg as any).token ?? "",
      template_os_concluida: (cfg as any).template_os_concluida ?? "",
      template_os_entregue: (cfg as any).template_os_entregue ?? "",
      template_lembrete_oleo: (cfg as any).template_lembrete_oleo ?? "",
      template_cobranca: (cfg as any).template_cobranca ?? "",
    });
  }, [cfg]);

  const mSave = useMutation({
    mutationFn: (d: typeof form) => upsert({ data: d }),
    onSuccess: () => { toast.success("Configuração salva"); qc.invalidateQueries({ queryKey: ["wa-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <MessageCircle className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">WhatsApp</h1>
            <p className="text-sm text-muted-foreground mt-1">Mensagens automáticas via UAZAPI e templates por evento.</p>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-2">
        {[{ key: "mensagens" as const, label: "Mensagens", icon: MessageCircle }, { key: "config" as const, label: "Configuração", icon: Settings2 }].map(t => (
          <button key={t.key} onClick={() => setAba(t.key)}
            className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition",
              aba === t.key ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {aba === "mensagens" && (
        <div className="glass rounded-2xl overflow-hidden">
          {isLoading && <div className="p-10 text-center text-muted-foreground text-sm">Carregando…</div>}
          {!isLoading && (msgs as Msg[]).length === 0 && (
            <div className="p-10 text-center text-muted-foreground text-sm">
              Nenhuma mensagem ainda. Mensagens são geradas automaticamente quando OS muda de status.
            </div>
          )}
          <div className="divide-y divide-border/40">
            {(msgs as Msg[]).map((m) => (
              <div key={m.id} className="flex items-start gap-4 p-4 hover:bg-secondary/40 transition">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                  {m.telefone.slice(-4)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{m.telefone}</span>
                    <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{m.mensagem}</div>
                  {m.erro && <div className="mt-1 text-xs text-destructive">{m.erro}</div>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-secondary text-muted-foreground">
                    {statusIcon[m.status] ?? null} {m.status}
                  </span>
                  {m.evento && <span className="text-[10px] text-muted-foreground">{m.evento}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {aba === "config" && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Automação ativa</div>
                <div className="text-xs text-muted-foreground">Envia mensagens automáticas em eventos de OS.</div>
              </div>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm(s => ({ ...s, ativo: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>UAZAPI Instance URL</Label><Input value={form.instance_url} onChange={e => setForm(s => ({ ...s, instance_url: e.target.value }))} placeholder="https://..." /></div>
              <div><Label>UAZAPI Token</Label><Input type="password" value={form.token} onChange={e => setForm(s => ({ ...s, token: e.target.value }))} /></div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 space-y-3">
            <h3 className="font-medium text-sm">Templates (variáveis: {`{cliente}, {numero}, {valor}, {oficina}, {veiculo}, {placa}, {data}`})</h3>
            <div><Label>OS concluída</Label><Textarea rows={2} value={form.template_os_concluida} onChange={e => setForm(s => ({ ...s, template_os_concluida: e.target.value }))} /></div>
            <div><Label>OS entregue</Label><Textarea rows={2} value={form.template_os_entregue} onChange={e => setForm(s => ({ ...s, template_os_entregue: e.target.value }))} /></div>
            <div><Label>Lembrete de óleo</Label><Textarea rows={2} value={form.template_lembrete_oleo} onChange={e => setForm(s => ({ ...s, template_lembrete_oleo: e.target.value }))} /></div>
            <div><Label>Cobrança</Label><Textarea rows={2} value={form.template_cobranca} onChange={e => setForm(s => ({ ...s, template_cobranca: e.target.value }))} /></div>
          </div>

          <Button onClick={() => mSave.mutate(form)} disabled={mSave.isPending} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" /> {mSave.isPending ? "Salvando…" : "Salvar configuração"}
          </Button>
        </div>
      )}
    </div>
  );
}
