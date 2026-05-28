import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Download, DollarSign, ClipboardList, Users, Package, AlertTriangle } from "lucide-react";
import { getResumo, exportLancamentos, exportOrdens } from "@/lib/relatorios.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/relatorios")({ component: Page });

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function toCSV(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v == null) return "";
    if (typeof v === "object") v = JSON.stringify(v);
    const s = String(v).replace(/"/g, '""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  };
  return [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
}

function download(name: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Page() {
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [from, setFrom] = useState(ini.toISOString().slice(0, 10));
  const [to, setTo] = useState(hoje.toISOString().slice(0, 10));

  const fnResumo = useServerFn(getResumo);
  const fnLanc = useServerFn(exportLancamentos);
  const fnOS = useServerFn(exportOrdens);

  const { data, isLoading } = useQuery({
    queryKey: ["relatorios", from, to],
    queryFn: () => fnResumo({ data: { from, to } }),
  });

  const baixarLanc = async () => {
    try {
      const rows = await fnLanc({ data: { from, to } });
      if (!rows.length) return toast.info("Sem lançamentos no período");
      download(`financeiro_${from}_${to}.csv`, toCSV(rows));
    } catch (e: any) { toast.error(e?.message ?? "Falha ao exportar"); }
  };

  const baixarOS = async () => {
    try {
      const rows = await fnOS({ data: { from, to } });
      const flat = rows.map((r: any) => ({
        numero: r.numero,
        status: r.status,
        valor_total: r.valor_total,
        desconto: r.desconto,
        data_abertura: r.data_abertura,
        data_conclusao: r.data_conclusao,
        cliente: r.clientes?.nome,
        placa: r.veiculos?.placa,
        veiculo: r.veiculos ? `${r.veiculos.marca ?? ""} ${r.veiculos.modelo ?? ""}`.trim() : "",
      }));
      if (!flat.length) return toast.info("Sem OS no período");
      download(`ordens_${from}_${to}.csv`, toCSV(flat));
    } catch (e: any) { toast.error(e?.message ?? "Falha ao exportar"); }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
          <BarChart3 className="h-5 w-5 text-neon-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">Resumo do período e exportação em CSV.</p>
        </div>
      </motion.div>

      <div className="glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="from">De</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">Até</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="secondary" onClick={baixarLanc}><Download className="h-4 w-4 mr-2" />Financeiro CSV</Button>
          <Button variant="secondary" onClick={baixarOS}><Download className="h-4 w-4 mr-2" />OS CSV</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Receita (total)", value: brl(data?.financeiro.totalReceita ?? 0), icon: DollarSign },
          { label: "Receita paga", value: brl(data?.financeiro.receitaPaga ?? 0), icon: DollarSign },
          { label: "A receber", value: brl(data?.financeiro.aReceber ?? 0), icon: DollarSign },
          { label: "Despesas", value: brl(data?.financeiro.totalDespesa ?? 0), icon: DollarSign },
        ].map((k) => (
          <div key={k.label} className="glass rounded-2xl p-5 flex items-center gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/80 border border-border/60">
              <k.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="font-display text-xl font-semibold">{isLoading ? "—" : k.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Ordens de serviço por status</h2>
          </div>
          {data && Object.keys(data.os.porStatus).length ? (
            <div className="space-y-2">
              {Object.entries(data.os.porStatus).map(([k, v]: any) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{k.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">{v.qtd} · {brl(v.valor)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-border/40 flex justify-between text-sm font-medium">
                <span>Total</span><span>{data.os.total}</span>
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Sem OS no período.</p>}
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Clientes</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Total cadastrados</span><span className="font-medium">{data?.clientes.total ?? 0}</span></div>
            <div className="flex justify-between"><span>Novos no período</span><span className="font-medium">{data?.clientes.novos ?? 0}</span></div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Estoque crítico</h2>
          </div>
          {data?.estoqueBaixo.length ? (
            <ul className="divide-y divide-border/40">
              {data.estoqueBaixo.map((i: any) => (
                <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />{i.nome}</span>
                  <span className="text-muted-foreground">{i.quantidade} / mín {i.qtd_minima}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nenhum item abaixo do mínimo.</p>}
        </div>
      </div>
    </div>
  );
}
