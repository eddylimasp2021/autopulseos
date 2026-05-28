import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Droplet, Search, Plus, Trash2, User, Car } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { listTrocas, createTroca, updateTrocaStatus, deleteTroca } from "@/lib/troca-oleo.functions";
import { listClientes } from "@/lib/clientes.functions";
import { listVeiculos } from "@/lib/veiculos.functions";

export const Route = createFileRoute("/_authenticated/app/troca-oleo")({ component: Page });

const Schema = z.object({
  cliente_id: z.string().uuid("Selecione o cliente"),
  veiculo_id: z.string().uuid("Selecione o veículo"),
  data: z.string().min(1, "Obrigatório"),
  km_atual: z.string().optional(),
  km_proxima: z.string().optional(),
  proxima_data: z.string().optional(),
  oleo_tipo: z.string().optional(),
  oleo_marca: z.string().optional(),
  filtro_oleo: z.string().optional(),
  filtro_ar: z.string().optional(),
  filtro_combustivel: z.string().optional(),
  status: z.enum(["agendada", "em_andamento", "realizado", "cancelado"]),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof Schema>;

type Row = {
  id: string; data: string; km_atual: number | null; km_proxima: number | null;
  oleo_tipo: string | null; oleo_marca: string | null; filtro_oleo: string | null;
  proxima_data: string | null; status: string;
  clientes?: { nome: string } | null;
  veiculos?: { placa: string; marca: string | null; modelo: string | null } | null;
};

const statusBg: Record<string, string> = {
  realizado: "bg-success/15 text-success",
  em_andamento: "bg-primary/15 text-primary",
  agendada: "bg-warning/15 text-warning",
  cancelado: "bg-muted text-muted-foreground",
};

function Page() {
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const list = useServerFn(listTrocas);
  const create = useServerFn(createTroca);
  const updStatus = useServerFn(updateTrocaStatus);
  const remove = useServerFn(deleteTroca);
  const listCli = useServerFn(listClientes);
  const listVei = useServerFn(listVeiculos);

  const { data: trocas = [], isLoading } = useQuery({ queryKey: ["trocas"], queryFn: () => list() });
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: () => listCli() });
  const { data: veiculos = [] } = useQuery({ queryKey: ["veiculos"], queryFn: () => listVei() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["trocas"] });

  const mCreate = useMutation({
    mutationFn: (d: any) => create({ data: d }),
    onSuccess: () => { toast.success("Troca registrada"); invalidate(); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mStatus = useMutation({
    mutationFn: (v: { id: string; status: any }) => updStatus({ data: v }),
    onSuccess: () => { toast.success("Status atualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtrados = (trocas as Row[]).filter(t => {
    const q = busca.toLowerCase();
    return (t.clientes?.nome ?? "").toLowerCase().includes(q) || (t.veiculos?.placa ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <Droplet className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Troca de Óleo</h1>
            <p className="text-sm text-muted-foreground mt-1">Checklist rápido e lembrete automático da próxima troca.</p>
          </div>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 shadow-[0_0_20px_-4px_oklch(0.65_0.18_240/0.4)]">
          <Plus className="h-4 w-4" /> Nova troca
        </button>
      </motion.div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cliente ou placa..." className="w-full rounded-xl border border-border bg-secondary/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">Cliente / Veículo</th>
                <th className="px-5 py-3 font-medium">Óleo / Filtro</th>
                <th className="px-5 py-3 font-medium">KM</th>
                <th className="px-5 py-3 font-medium">Próxima</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((t) => (
                <tr key={t.id} className="border-b border-border/40 hover:bg-secondary/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 font-medium"><User className="h-3 w-3 text-muted-foreground" /> {t.clientes?.nome ?? "—"}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5"><Car className="h-3 w-3" /> {t.veiculos?.marca ?? ""} {t.veiculos?.modelo ?? ""} · {t.veiculos?.placa ?? ""}</div>
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    <div>{t.oleo_marca ?? "—"} {t.oleo_tipo ?? ""}</div>
                    <div className="text-muted-foreground">{t.filtro_oleo ?? "—"}</div>
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    <div>Atual: {t.km_atual?.toLocaleString("pt-BR") ?? "—"}</div>
                    <div className="text-muted-foreground">Próx: {t.km_proxima?.toLocaleString("pt-BR") ?? "—"}</div>
                  </td>
                  <td className="px-5 py-3.5 text-xs">{t.proxima_data ? new Date(t.proxima_data).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-5 py-3.5">
                    <select value={t.status} onChange={(e) => mStatus.mutate({ id: t.id, status: e.target.value })}
                      className={cn("rounded-full px-2.5 py-1 text-xs font-medium border-0 outline-none cursor-pointer", statusBg[t.status] ?? "bg-muted")}>
                      <option value="agendada">Agendada</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="realizado">Realizado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => { if (confirm("Excluir registro?")) mDelete.mutate(t.id); }} className="h-8 w-8 inline-grid place-items-center rounded-lg hover:bg-destructive/20 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="p-10 text-center text-muted-foreground text-sm">Carregando…</div>}
        {!isLoading && filtrados.length === 0 && <div className="p-10 text-center text-muted-foreground text-sm">Nenhum registro.</div>}
      </div>

      <TrocaDialog open={open} onOpenChange={setOpen}
        clientes={clientes as any[]} veiculos={veiculos as any[]}
        loading={mCreate.isPending}
        onSubmit={(d) => mCreate.mutate({
          cliente_id: d.cliente_id, veiculo_id: d.veiculo_id, data: d.data,
          km_atual: d.km_atual ? Number(d.km_atual) : null,
          km_proxima: d.km_proxima ? Number(d.km_proxima) : null,
          proxima_data: d.proxima_data || null,
          oleo_tipo: d.oleo_tipo, oleo_marca: d.oleo_marca,
          filtro_oleo: d.filtro_oleo, filtro_ar: d.filtro_ar, filtro_combustivel: d.filtro_combustivel,
          status: d.status, observacoes: d.observacoes,
        })} />
    </div>
  );
}

function TrocaDialog({ open, onOpenChange, onSubmit, loading, clientes, veiculos }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (d: FormData) => void; loading: boolean;
  clientes: { id: string; nome: string }[];
  veiculos: { id: string; placa: string; cliente_id: string; marca: string | null; modelo: string | null }[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { cliente_id: "", veiculo_id: "", data: today, status: "realizado" },
  });
  const cliId = watch("cliente_id");
  const veicsFiltrados = useMemo(() => veiculos.filter(v => !cliId || v.cliente_id === cliId), [veiculos, cliId]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Nova troca de óleo</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente *</Label>
              <select {...register("cliente_id")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecione…</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              {errors.cliente_id && <p className="text-xs text-destructive mt-1">{errors.cliente_id.message}</p>}
            </div>
            <div>
              <Label>Veículo *</Label>
              <select {...register("veiculo_id")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecione…</option>
                {veicsFiltrados.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.marca ?? ""} {v.modelo ?? ""}</option>)}
              </select>
              {errors.veiculo_id && <p className="text-xs text-destructive mt-1">{errors.veiculo_id.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Data *</Label><Input type="date" {...register("data")} /></div>
            <div><Label>KM atual</Label><Input type="number" {...register("km_atual")} /></div>
            <div><Label>KM próxima</Label><Input type="number" {...register("km_proxima")} placeholder="auto +5000" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Óleo (tipo)</Label><Input {...register("oleo_tipo")} placeholder="5W30" /></div>
            <div><Label>Óleo (marca)</Label><Input {...register("oleo_marca")} placeholder="Castrol" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Filtro de óleo</Label><Input {...register("filtro_oleo")} /></div>
            <div><Label>Filtro de ar</Label><Input {...register("filtro_ar")} /></div>
            <div><Label>Filtro combust.</Label><Input {...register("filtro_combustivel")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Próxima data</Label>
              <Input type="date" {...register("proxima_data")} />
            </div>
            <div>
              <Label>Status</Label>
              <select {...register("status")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="agendada">Agendada</option>
                <option value="em_andamento">Em andamento</option>
                <option value="realizado">Realizado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
          <div><Label>Observações</Label><Textarea rows={2} {...register("observacoes")} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
