import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Wallet, ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, DollarSign, Search, Filter, Plus, Trash2, CheckCircle2 } from "lucide-react";
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
import { listLancamentos, createLancamento, updateLancamentoStatus, deleteLancamento } from "@/lib/financeiro.functions";

export const Route = createFileRoute("/_authenticated/app/financeiro")({ component: Page });

const Schema = z.object({
  tipo: z.enum(["receita", "despesa"]),
  descricao: z.string().trim().min(1, "Obrigatório").max(200),
  categoria: z.string().trim().max(80).optional(),
  valor: z.string().min(1, "Informe o valor"),
  data_vencimento: z.string().min(1, "Obrigatório"),
  forma_pagamento: z.string().trim().max(40).optional(),
  status: z.enum(["pendente", "pago", "atrasado", "cancelado"]),
  observacoes: z.string().trim().max(1000).optional(),
});
type FormData = z.infer<typeof Schema>;

type L = { id: string; tipo: "receita" | "despesa"; categoria: string | null; descricao: string; valor: number; data_vencimento: string; data_pagamento: string | null; status: string; forma_pagamento: string | null; clientes?: { nome: string } | null };

const statusBg: Record<string, string> = {
  pago: "bg-success/15 text-success",
  pendente: "bg-warning/15 text-warning",
  atrasado: "bg-destructive/15 text-destructive",
  cancelado: "bg-muted text-muted-foreground",
};

function Page() {
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [openForm, setOpenForm] = useState(false);
  const qc = useQueryClient();

  const list = useServerFn(listLancamentos);
  const create = useServerFn(createLancamento);
  const updStatus = useServerFn(updateLancamentoStatus);
  const remove = useServerFn(deleteLancamento);

  const { data: lancs = [], isLoading } = useQuery({ queryKey: ["financeiro"], queryFn: () => list() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["financeiro"] });

  const mCreate = useMutation({
    mutationFn: (d: any) => create({ data: d }),
    onSuccess: () => { toast.success("Lançamento criado"); invalidate(); setOpenForm(false); },
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

  const filtrados = (lancs as L[]).filter(t => {
    const matchBusca = t.descricao.toLowerCase().includes(busca.toLowerCase());
    const matchTipo = filtroTipo === "todos" ? true : t.tipo === filtroTipo;
    return matchBusca && matchTipo;
  });

  const entradas = (lancs as L[]).filter(t => t.tipo === "receita" && t.status === "pago").reduce((s, t) => s + Number(t.valor), 0);
  const saidas = (lancs as L[]).filter(t => t.tipo === "despesa" && t.status === "pago").reduce((s, t) => s + Number(t.valor), 0);
  const saldo = entradas - saidas;
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <Wallet className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Financeiro</h1>
            <p className="text-sm text-muted-foreground mt-1">Contas a pagar/receber e fluxo de caixa por oficina.</p>
          </div>
        </div>
        <button onClick={() => setOpenForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 shadow-[0_0_20px_-4px_oklch(0.65_0.18_240/0.4)]">
          <Plus className="h-4 w-4" /> Novo lançamento
        </button>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Entradas pagas", value: fmt(entradas), icon: TrendingUp, color: "text-success", iconBg: "bg-success/15" },
          { label: "Saídas pagas", value: fmt(saidas), icon: TrendingDown, color: "text-destructive", iconBg: "bg-destructive/15" },
          { label: "Saldo", value: fmt(saldo), icon: DollarSign, color: saldo >= 0 ? "text-primary" : "text-destructive", iconBg: saldo >= 0 ? "bg-primary/15" : "bg-destructive/15" },
        ].map((k) => (
          <div key={k.label} className="glass rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
            <div className="flex items-start justify-between relative">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</div>
                <div className="mt-2 text-2xl font-semibold font-display">{k.value}</div>
              </div>
              <div className={cn("grid h-10 w-10 place-items-center rounded-xl", k.iconBg)}>
                <k.icon className={cn("h-4 w-4", k.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar lançamento..." className="w-full rounded-xl border border-border bg-secondary/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="bg-transparent outline-none text-sm cursor-pointer">
            <option value="todos">Todos</option>
            <option value="receita">Receitas</option>
            <option value="despesa">Despesas</option>
          </select>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">Descrição</th>
                <th className="px-5 py-3 font-medium">Categoria</th>
                <th className="px-5 py-3 font-medium">Vencimento</th>
                <th className="px-5 py-3 font-medium">Forma</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((t) => (
                <tr key={t.id} className="border-b border-border/40 hover:bg-secondary/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 font-medium">
                      {t.tipo === "receita" ? <ArrowDownLeft className="h-4 w-4 text-success" /> : <ArrowUpRight className="h-4 w-4 text-destructive" />}
                      {t.descricao}
                    </div>
                    {t.clientes?.nome && <div className="text-xs text-muted-foreground mt-0.5">{t.clientes.nome}</div>}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">{t.categoria ?? "—"}</td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">{new Date(t.data_vencimento).toLocaleDateString("pt-BR")}</td>
                  <td className="px-5 py-3.5 text-xs">{t.forma_pagamento ?? "—"}</td>
                  <td className={cn("px-5 py-3.5 font-semibold", t.tipo === "receita" ? "text-success" : "text-destructive")}>
                    {t.tipo === "receita" ? "+" : "−"} {fmt(Number(t.valor))}
                  </td>
                  <td className="px-5 py-3.5">
                    <select value={t.status} onChange={(e) => mStatus.mutate({ id: t.id, status: e.target.value })}
                      className={cn("rounded-full px-2.5 py-1 text-xs font-medium border-0 outline-none cursor-pointer", statusBg[t.status] ?? "bg-muted")}>
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="atrasado">Atrasado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      {t.status !== "pago" && (
                        <button onClick={() => mStatus.mutate({ id: t.id, status: "pago" })} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-success/20 text-success" title="Marcar como pago">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => { if (confirm("Excluir lançamento?")) mDelete.mutate(t.id); }} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/20 text-destructive" title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="p-10 text-center text-muted-foreground text-sm">Carregando…</div>}
        {!isLoading && filtrados.length === 0 && <div className="p-10 text-center text-muted-foreground text-sm">Nenhum lançamento.</div>}
      </div>

      <LancDialog open={openForm} onOpenChange={setOpenForm} loading={mCreate.isPending}
        onSubmit={(d) => mCreate.mutate({
          tipo: d.tipo, descricao: d.descricao, categoria: d.categoria,
          valor: Number(d.valor), data_vencimento: d.data_vencimento,
          forma_pagamento: d.forma_pagamento, status: d.status, observacoes: d.observacoes,
        })} />
    </div>
  );
}

function LancDialog({ open, onOpenChange, onSubmit, loading }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (d: FormData) => void; loading: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { tipo: "receita", descricao: "", categoria: "", valor: "", data_vencimento: today, forma_pagamento: "", status: "pendente", observacoes: "" },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tipo">Tipo *</Label>
              <select id="tipo" {...register("tipo")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <select id="status" {...register("status")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="atrasado">Atrasado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="descricao">Descrição *</Label>
            <Input id="descricao" {...register("descricao")} />
            {errors.descricao && <p className="text-xs text-destructive mt-1">{errors.descricao.message}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="valor">Valor *</Label>
              <Input id="valor" type="number" step="0.01" {...register("valor")} />
              {errors.valor && <p className="text-xs text-destructive mt-1">{errors.valor.message}</p>}
            </div>
            <div>
              <Label htmlFor="data_vencimento">Vencimento *</Label>
              <Input id="data_vencimento" type="date" {...register("data_vencimento")} />
            </div>
            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <Input id="categoria" {...register("categoria")} />
            </div>
          </div>
          <div>
            <Label htmlFor="forma_pagamento">Forma de pagamento</Label>
            <Input id="forma_pagamento" {...register("forma_pagamento")} placeholder="PIX, Cartão, Dinheiro…" />
          </div>
          <div><Label htmlFor="observacoes">Observações</Label><Textarea id="observacoes" rows={2} {...register("observacoes")} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}