import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Calendar, ChevronLeft, ChevronRight, Clock, User, Car,
  ClipboardList, CheckCircle2, CircleDot, Droplet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAgenda } from "@/lib/agenda.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/agenda")({ component: Page });

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const statusLabel = (s: string) =>
  (({
    aberta: "Aberta",
    em_andamento: "Em atendimento",
    aguardando_aprovacao: "Aguardando",
    concluida: "Concluída",
    entregue: "Entregue",
    cancelada: "Cancelada",
    agendada: "Agendada",
    realizado: "Realizado",
    cancelado: "Cancelada",
  } as Record<string, string>)[s]) ?? s;

function Page() {
  const hoje = new Date();
  const [dataSelecionada, setDataSelecionada] = useState(hoje);
  const [semanaOffset, setSemanaOffset] = useState(0);

  const dias = useMemo(() => {
    const out: Date[] = [];
    const start = new Date(hoje);
    start.setDate(start.getDate() - start.getDay() + semanaOffset * 7);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaOffset]);

  const isHoje = (d: Date) => d.toDateString() === hoje.toDateString();
  const isSelecionado = (d: Date) => d.toDateString() === dataSelecionada.toDateString();

  const range = useMemo(
    () => ({ from: dias[0].toISOString().slice(0, 10), to: dias[6].toISOString().slice(0, 10) }),
    [dias],
  );

  const fetchAgenda = useServerFn(listAgenda);
  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["agenda", range.from, range.to],
    queryFn: () => fetchAgenda({ data: range }),
  });

  const selKey = dataSelecionada.toISOString().slice(0, 10);
  const agendamentosDia = eventos.filter((e: any) => e.data.slice(0, 10) === selKey);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <Calendar className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Agenda</h1>
            <p className="text-sm text-muted-foreground mt-1">Ordens de serviço e trocas de óleo agendadas.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSemanaOffset(s => s - 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/50 hover:bg-secondary transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => { setSemanaOffset(0); setDataSelecionada(new Date()); }} className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-4 py-2 text-sm font-medium hover:bg-secondary transition">
            Hoje
          </button>
          <button onClick={() => setSemanaOffset(s => s + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/50 hover:bg-secondary transition">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-4">
        <div className="grid grid-cols-7 gap-2">
          {dias.map((d, i) => {
            const dKey = d.toISOString().slice(0, 10);
            const qtd = eventos.filter((e: any) => e.data.slice(0, 10) === dKey).length;
            return (
              <button key={i} onClick={() => setDataSelecionada(d)}
                className={cn("flex flex-col items-center gap-1 rounded-xl py-3 transition",
                  isSelecionado(d) ? "bg-primary text-primary-foreground" : "hover:bg-secondary/60",
                  isHoje(d) && !isSelecionado(d) && "border border-primary/40")}>
                <span className="text-[10px] uppercase tracking-wider opacity-80">{diasSemana[d.getDay()]}</span>
                <span className="font-display text-lg font-semibold">{d.getDate()}</span>
                {qtd > 0 ? (
                  <span className="text-[10px] opacity-80">{qtd}</span>
                ) : isHoje(d) ? (
                  <span className="h-1 w-1 rounded-full bg-current" />
                ) : null}
              </button>
            );
          })}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Agendamentos — {dataSelecionada.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </h2>
        <div className="space-y-3">
          {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
          {!isLoading && agendamentosDia.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhum evento nesta data.</div>
          )}
          {agendamentosDia.map((a: any, i: number) => {
            const hora = new Date(a.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            const isConcluido = a.status === "concluida" || a.status === "entregue" || a.status === "realizado";
            const isAndamento = a.status === "em_andamento";
            return (
              <motion.div key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.04 }}
                className="flex items-center gap-4 rounded-xl border border-border/60 bg-secondary/30 p-4 hover:bg-secondary/50 transition">
                <div className="flex flex-col items-center min-w-[60px]">
                  <span className="font-display text-lg font-bold">{hora}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">{a.tipo === "os" ? "OS" : "Óleo"}</span>
                </div>
                <div className="h-8 w-px bg-border/60" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                      isConcluido ? "bg-success/15 text-success" :
                      isAndamento ? "bg-primary/15 text-primary" :
                      "bg-warning/15 text-warning")}>
                      {isConcluido ? <CheckCircle2 className="h-3 w-3" /> : isAndamento ? <CircleDot className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {statusLabel(a.status)}
                    </span>
                  </div>
                  <div className="mt-1 font-medium">{a.titulo}</div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {a.cliente}</span>
                    <span className="flex items-center gap-1"><Car className="h-3 w-3" /> {a.veiculo}</span>
                  </div>
                </div>
                <div className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium shrink-0">
                  {a.tipo === "os" ? (
                    <><ClipboardList className="h-3.5 w-3.5 inline mr-1" /> OS</>
                  ) : (
                    <><Droplet className="h-3.5 w-3.5 inline mr-1" /> Óleo</>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}