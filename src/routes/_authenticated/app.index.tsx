import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  CartesianGrid, Tooltip,
} from "recharts";
import {
  DollarSign, ClipboardList, Car, Droplet, Package, TrendingUp,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/_authenticated/app/")({ component: Dashboard });

function fmt(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function Dashboard() {
  const fetchDash = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDash() });

  const revenue = data?.semana ?? [];
  const services = data?.topServicos ?? [];
  const totalSemana = revenue.reduce((s, r) => s + r.v, 0);

  const kpis = [
    { label: "Faturamento (dia)", value: fmt(data?.faturamentoDia ?? 0), delta: "", up: true, icon: DollarSign },
    { label: "Faturamento (mês)", value: fmt(data?.faturamentoMes ?? 0), delta: "", up: true, icon: TrendingUp },
    { label: "OS abertas", value: String(data?.osAbertas ?? 0), delta: (data?.osAguardandoAprov ?? 0) > 0 ? `${data?.osAguardandoAprov} aguardando` : "", up: true, icon: ClipboardList },
    { label: "Veículos em atendimento", value: String(data?.veiculosAtend ?? 0), delta: "", up: true, icon: Car },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-sm text-muted-foreground mt-1">Operação em tempo real da sua oficina</p>
        </div>
        <div className="hidden md:flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs">
          <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_8px_currentColor]" />
          <span className="text-muted-foreground">{isLoading ? "Carregando dados…" : "Sistema online · sincronizado agora"}</span>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-5 relative overflow-hidden group hover:border-primary/30 transition-colors"
          >
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition-colors" />
            <div className="flex items-start justify-between relative">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</div>
                <div className="mt-2 text-2xl font-semibold font-display">{k.value}</div>
                {k.delta ? (
                  <div className={`mt-1 inline-flex items-center gap-1 text-xs ${k.up ? "text-success" : "text-destructive"}`}>
                    {k.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {k.delta}
                  </div>
                ) : null}
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/80 border border-border/60">
                <k.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Faturamento da semana</h2>
              <p className="text-xs text-muted-foreground">Receita diária</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold font-display">{fmt(totalSemana)}</div>
              <div className="text-xs text-muted-foreground">Últimos 7 dias</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenue}>
              <defs>
                <linearGradient id="rev" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.18 240)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="oklch(0.72 0.18 240)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.05)" />
              <XAxis dataKey="d" stroke="oklch(0.65 0.02 250)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.65 0.02 250)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v / 1000}k`} />
              <Tooltip contentStyle={{ background: "oklch(0.18 0.012 250)", border: "1px solid oklch(1 0 0 / 0.08)", borderRadius: 12 }} formatter={(v) => fmt(Number(v))} />
              <Area type="monotone" dataKey="v" stroke="oklch(0.72 0.18 240)" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-5">
          <h2 className="font-display text-lg font-semibold mb-1">Top serviços</h2>
          <p className="text-xs text-muted-foreground mb-4">Últimos 30 dias</p>
          {services.length === 0 ? (
            <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">Sem serviços registrados ainda</div>
          ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={services} layout="vertical" margin={{ left: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" stroke="oklch(0.85 0.01 250)" fontSize={11} tickLine={false} axisLine={false} width={90} />
              <Tooltip contentStyle={{ background: "oklch(0.18 0.012 250)", border: "1px solid oklch(1 0 0 / 0.08)", borderRadius: 12 }} />
              <Bar dataKey="v" radius={[0, 8, 8, 0]} fill="oklch(0.72 0.18 240)" />
            </BarChart>
          </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: Droplet, title: "Próximas trocas de óleo", value: `${data?.proximasTrocas ?? 0} próximos 7 dias`, color: "text-primary" },
          { icon: Package, title: "Itens em estoque baixo", value: `${data?.estoqueBaixoQtd ?? 0} produtos`, color: "text-warning" },
          { icon: ClipboardList, title: "OS aguardando aprovação", value: `${data?.osAguardandoAprov ?? 0} orçamentos`, color: "text-success" },
        ].map((c, i) => (
          <motion.div key={c.title}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.05 }}
            className="glass rounded-2xl p-5 flex items-center gap-4 hover:border-primary/30 transition">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary/80 border border-border/60">
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{c.title}</div>
              <div className="font-display text-lg font-semibold">{c.value}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}