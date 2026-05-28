import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Car, Search, Plus, Fuel, User, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { listVeiculos, createVeiculo, updateVeiculo, deleteVeiculo } from "@/lib/veiculos.functions";
import { listClientes } from "@/lib/clientes.functions";

export const Route = createFileRoute("/_authenticated/app/veiculos")({ component: Page });

const Schema = z.object({
  cliente_id: z.string().uuid("Selecione o cliente"),
  placa: z.string().trim().min(1, "Placa obrigatória").max(10),
  marca: z.string().trim().max(60).optional(),
  modelo: z.string().trim().max(80).optional(),
  ano: z.string().optional(),
  cor: z.string().trim().max(40).optional(),
  combustivel: z.string().trim().max(40).optional(),
  km_atual: z.string().optional(),
});
type FormData = z.infer<typeof Schema>;
type Veiculo = { id: string; cliente_id: string; placa: string; marca: string | null; modelo: string | null; ano: number | null; cor: string | null; km_atual: number | null; clientes?: { nome: string } | null };

function Page() {
  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState<Veiculo | null>(null);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const list = useServerFn(listVeiculos);
  const listCli = useServerFn(listClientes);
  const create = useServerFn(createVeiculo);
  const update = useServerFn(updateVeiculo);
  const remove = useServerFn(deleteVeiculo);

  const { data: veiculos = [], isLoading } = useQuery({ queryKey: ["veiculos"], queryFn: () => list() });
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: () => listCli() });

  const mCreate = useMutation({
    mutationFn: (d: FormData) => create({ data: { ...d, ano: d.ano ? Number(d.ano) : undefined, km_atual: d.km_atual ? Number(d.km_atual) : undefined } as any }),
    onSuccess: () => { toast.success("Veículo criado"); qc.invalidateQueries({ queryKey: ["veiculos"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mUpdate = useMutation({
    mutationFn: (d: FormData & { id: string }) => update({ data: { ...d, ano: d.ano ? Number(d.ano) : undefined, km_atual: d.km_atual ? Number(d.km_atual) : undefined } as any }),
    onSuccess: () => { toast.success("Veículo atualizado"); qc.invalidateQueries({ queryKey: ["veiculos"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Veículo excluído"); qc.invalidateQueries({ queryKey: ["veiculos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (veiculos as Veiculo[]).filter(v => {
    const s = busca.toLowerCase();
    return v.placa.toLowerCase().includes(s) || (v.modelo ?? "").toLowerCase().includes(s) || (v.clientes?.nome ?? "").toLowerCase().includes(s);
  });

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(v: Veiculo) { setEditing(v); setOpen(true); }
  function handleDelete(v: Veiculo) {
    if (confirm(`Excluir veículo ${v.placa}?`)) mDelete.mutate(v.id);
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <Car className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Veículos</h1>
            <p className="text-sm text-muted-foreground mt-1">Cadastro de veículos por cliente.</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 shadow-[0_0_20px_-4px_oklch(0.65_0.18_240/0.4)]">
          <Plus className="h-4 w-4" /> Novo veículo
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por placa, modelo ou cliente..." className="w-full rounded-xl border border-border bg-secondary/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground" />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((v, i) => (
          <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}
            className="glass rounded-2xl p-5 hover:border-primary/30 transition group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/80 border border-border/60">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">{[v.marca, v.modelo].filter(Boolean).join(" ") || v.placa}</div>
                  <div className="text-xs text-muted-foreground">{v.placa}{v.ano ? ` · ${v.ano}` : ""}{v.cor ? ` · ${v.cor}` : ""}</div>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => openEdit(v)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-secondary transition" title="Editar">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(v)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-destructive/20 text-destructive transition" title="Excluir">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
              {v.km_atual != null && <div className="flex items-center gap-2"><Fuel className="h-3 w-3" /> {v.km_atual.toLocaleString("pt-BR")} km</div>}
              {v.clientes?.nome && <div className="flex items-center gap-2"><User className="h-3 w-3" /> {v.clientes.nome}</div>}
            </div>
          </motion.div>
        ))}
      </motion.div>
      {isLoading && <div className="p-10 text-center text-muted-foreground text-sm">Carregando…</div>}
      {!isLoading && filtered.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground text-sm">Nenhum veículo cadastrado.</div>
      )}

      <VeiculoDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        editing={editing}
        clientes={clientes as { id: string; nome: string }[]}
        onSubmit={(d) => editing ? mUpdate.mutate({ ...d, id: editing.id }) : mCreate.mutate(d)}
        loading={mCreate.isPending || mUpdate.isPending}
      />
    </div>
  );
}

function VeiculoDialog({ open, onOpenChange, editing, clientes, onSubmit, loading }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: Veiculo | null;
  clientes: { id: string; nome: string }[];
  onSubmit: (d: FormData) => void; loading: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
    values: {
      cliente_id: editing?.cliente_id ?? "",
      placa: editing?.placa ?? "",
      marca: editing?.marca ?? "",
      modelo: editing?.modelo ?? "",
      ano: editing?.ano?.toString() ?? "",
      cor: editing?.cor ?? "",
      combustivel: "",
      km_atual: editing?.km_atual?.toString() ?? "",
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar veículo" : "Novo veículo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => onSubmit(d))} className="space-y-3">
          <div>
            <Label htmlFor="cliente_id">Cliente *</Label>
            <select id="cliente_id" {...register("cliente_id")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">— selecione —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            {errors.cliente_id && <p className="text-xs text-destructive mt-1">{errors.cliente_id.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="placa">Placa *</Label>
              <Input id="placa" {...register("placa")} className="uppercase" />
              {errors.placa && <p className="text-xs text-destructive mt-1">{errors.placa.message}</p>}
            </div>
            <div>
              <Label htmlFor="ano">Ano</Label>
              <Input id="ano" type="number" {...register("ano")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="marca">Marca</Label>
              <Input id="marca" {...register("marca")} />
            </div>
            <div>
              <Label htmlFor="modelo">Modelo</Label>
              <Input id="modelo" {...register("modelo")} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="cor">Cor</Label>
              <Input id="cor" {...register("cor")} />
            </div>
            <div>
              <Label htmlFor="combustivel">Combustível</Label>
              <Input id="combustivel" {...register("combustivel")} />
            </div>
            <div>
              <Label htmlFor="km_atual">KM atual</Label>
              <Input id="km_atual" type="number" {...register("km_atual")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
