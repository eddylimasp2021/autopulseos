import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ClipboardList, Search, Plus, Wrench, Car, User, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { listOrdens, createOrdem, updateOrdemStatus, deleteOrdem } from "@/lib/ordens.functions";
import { listClientes } from "@/lib/clientes.functions";
import { listVeiculos } from "@/lib/veiculos.functions";

export const Route = createFileRoute("/_authenticated/app/ordens")({ component: Page });

const STATUS = ["aberta", "em_andamento", "aguardando_peca", "concluida", "cancelada", "entregue"] as const;
const statusLabel: Record<string, string> = {
  aberta: "Aberta", em_andamento: "Em andamento", aguardando_peca: "Aguardando peça",
  concluida: "Concluída", cancelada: "Cancelada", entregue: "Entregue",
};
const statusBg: Record<string, string> = {
  aberta: "bg-primary/15 text-primary",
  em_andamento: "bg-primary/15 text-primary",
  aguardando_peca: "bg-warning/15 text-warning",
  concluida: "bg-success/15 text-success",
  cancelada: "bg-muted text-muted-foreground",
  entregue: "bg-muted text-muted-foreground",
};

const Schema = z.object({
  cliente_id: z.string().uuid("Selecione o cliente"),
  veiculo_id: z.string().uuid("Selecione o veículo"),
  descricao: z.string().trim().max(2000).optional(),
  km_entrada: z.string().optional(),
  valor: z.string().min(1, "Informe o valor"),
  desconto: z.string().optional(),
});
type FormData = z.infer<typeof Schema>;
type OS = { id: string; numero: number; status: string; valor_total: number; desconto: number; data_abertura: string; descricao: string | null; clientes?: { nome: string } | null; veiculos?: { placa: string; marca: string | null; modelo: string | null } | null };

function Page() {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const list = useServerFn(listOrdens);
  const create = useServerFn(createOrdem);
  const updateStatus = useServerFn(updateOrdemStatus);
  const remove = useServerFn(deleteOrdem);
  const listCli = useServerFn(listClientes);
  const listVei = useServerFn(listVeiculos);

  const { data: ordens = [], isLoading } = useQuery({ queryKey: ["ordens"], queryFn: () => list() });
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: () => listCli() });
  const { data: veiculos = [] } = useQuery({ queryKey: ["veiculos"], queryFn: () => listVei() });

  const mCreate = useMutation({
    mutationFn: (d: FormData) => create({ data: {
      cliente_id: d.cliente_id, veiculo_id: d.veiculo_id,
      descricao: d.descricao, km_entrada: d.km_entrada ? Number(d.km_entrada) : undefined,
      desconto: d.desconto ? Number(d.desconto) : 0,
      itens: [{ descricao: d.descricao || "Serviço", tipo: "servico", quantidade: 1, valor_unit: Number(d.valor) }],
    } as any }),
    onSuccess: () => { toast.success("OS criada"); qc.invalidateQueries({ queryKey: ["ordens"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mStatus = useMutation({
    mutationFn: (v: { id: string; status: string }) => updateStatus({ data: v as any }),
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["ordens"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("OS excluída"); qc.invalidateQueries({ queryKey: ["ordens"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (ordens as OS[]).filter(o => {
    const s = busca.toLowerCase();
    const matchBusca = String(o.numero).includes(s) || (o.clientes?.nome ?? "").toLowerCase().includes(s) || (o.veiculos?.placa ?? "").toLowerCase().includes(s);
    const matchStatus = filtroStatus === "todos" || o.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <ClipboardList className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Ordens de Serviço</h1>
            <p className="text-sm text-muted-foreground mt-1">OS dispara baixa de estoque, lançamento financeiro e WhatsApp ao concluir.</p>
          </div>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 shadow-[0_0_20px_-4px_oklch(0.65_0.18_240/0.4)]">
          <Plus className="h-4 w-4" /> Nova OS
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por número, cliente ou placa..." className="w-full rounded-xl border border-border bg-secondary/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm">
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="bg-transparent outline-none text-sm cursor-pointer">
            <option value="todos">Todos os status</option>
            {STATUS.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
          </select>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">OS</th>
                <th className="px-5 py-3 font-medium">Cliente / Veículo</th>
                <th className="px-5 py-3 font-medium">Descrição</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                  <motion.tr key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border/40 hover:bg-secondary/40 transition-colors group">
                    <td className="px-5 py-3.5 font-mono text-xs text-primary font-medium">#{o.numero}</td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-medium"><User className="h-3 w-3 text-muted-foreground" /> {o.clientes?.nome ?? "—"}</div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Car className="h-3 w-3" /> {[o.veiculos?.marca, o.veiculos?.modelo].filter(Boolean).join(" ")} {o.veiculos?.placa ? `· ${o.veiculos.placa}` : ""}</div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5 text-muted-foreground" /> {o.descricao ?? "—"}</div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold">{fmt(Number(o.valor_total) - Number(o.desconto))}</td>
                    <td className="px-5 py-3.5">
                      <select value={o.status} onChange={(e) => mStatus.mutate({ id: o.id, status: e.target.value })}
                        className={cn("rounded-full px-2.5 py-1 text-xs font-medium border-0 outline-none cursor-pointer", statusBg[o.status])}>
                        {STATUS.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => { if (confirm(`Excluir OS #${o.numero}?`)) mDelete.mutate(o.id); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-destructive/20 text-destructive transition" title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="p-10 text-center text-muted-foreground text-sm">Carregando…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-10 text-center text-muted-foreground text-sm">Nenhuma OS cadastrada.</div>
        )}
      </motion.div>

      <OSDialog
        open={open}
        onOpenChange={setOpen}
        clientes={clientes as { id: string; nome: string }[]}
        veiculos={veiculos as { id: string; cliente_id: string; placa: string; marca: string | null; modelo: string | null }[]}
        onSubmit={(d) => mCreate.mutate(d)}
        loading={mCreate.isPending}
      />
    </div>
  );
}

function OSDialog({ open, onOpenChange, clientes, veiculos, onSubmit, loading }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  clientes: { id: string; nome: string }[];
  veiculos: { id: string; cliente_id: string; placa: string; marca: string | null; modelo: string | null }[];
  onSubmit: (d: FormData) => void; loading: boolean;
}) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { cliente_id: "", veiculo_id: "", descricao: "", km_entrada: "", valor: "", desconto: "" },
  });
  const cliente_id = watch("cliente_id");
  const veiculosFiltrados = cliente_id ? veiculos.filter(v => v.cliente_id === cliente_id) : veiculos;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Nova OS</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => onSubmit(d))} className="space-y-3">
          <div>
            <Label htmlFor="cliente_id">Cliente *</Label>
            <select id="cliente_id" {...register("cliente_id")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">— selecione —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            {errors.cliente_id && <p className="text-xs text-destructive mt-1">{errors.cliente_id.message}</p>}
          </div>
          <div>
            <Label htmlFor="veiculo_id">Veículo *</Label>
            <select id="veiculo_id" {...register("veiculo_id")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">— selecione —</option>
              {veiculosFiltrados.map(v => <option key={v.id} value={v.id}>{v.placa} · {[v.marca, v.modelo].filter(Boolean).join(" ")}</option>)}
            </select>
            {errors.veiculo_id && <p className="text-xs text-destructive mt-1">{errors.veiculo_id.message}</p>}
          </div>
          <div>
            <Label htmlFor="descricao">Descrição do serviço</Label>
            <Textarea id="descricao" {...register("descricao")} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="km_entrada">KM entrada</Label>
              <Input id="km_entrada" type="number" {...register("km_entrada")} />
            </div>
            <div>
              <Label htmlFor="valor">Valor *</Label>
              <Input id="valor" type="number" step="0.01" {...register("valor")} />
              {errors.valor && <p className="text-xs text-destructive mt-1">{errors.valor.message}</p>}
            </div>
            <div>
              <Label htmlFor="desconto">Desconto</Label>
              <Input id="desconto" type="number" step="0.01" {...register("desconto")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Criando…" : "Criar OS"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
