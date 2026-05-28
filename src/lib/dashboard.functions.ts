import { createServerFn } from "@tanstack/react-start";

export const getDashboard = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const hoje = new Date();
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
  const seteDiasAtras = new Date(hoje.getTime() - 6 * 24 * 60 * 60 * 1000);
  const inicioSemana = new Date(seteDiasAtras.getFullYear(), seteDiasAtras.getMonth(), seteDiasAtras.getDate()).toISOString().slice(0, 10);
  const proximos7 = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [finDia, finMes, finSemana, os, osAtend, estoque, trocas, osTopServ] = await Promise.all([
    supabase
      .from("financeiro_lancamentos")
      .select("valor")
      .eq("tipo", "receita")
      .eq("status", "pago")
      .gte("data_pagamento", inicioDia.slice(0, 10)),
    supabase
      .from("financeiro_lancamentos")
      .select("valor,tipo,status")
      .gte("data_vencimento", inicioMes)
      .lte("data_vencimento", fimMes),
    supabase
      .from("financeiro_lancamentos")
      .select("valor,data_pagamento")
      .eq("tipo", "receita")
      .eq("status", "pago")
      .gte("data_pagamento", inicioSemana),
    supabase.from("ordens_servico").select("id,status"),
    supabase.from("ordens_servico").select("id").eq("status", "em_andamento"),
    supabase.from("estoque_itens").select("id,nome,quantidade,qtd_minima,ativo").eq("ativo", true),
    supabase
      .from("troca_oleo")
      .select("id")
      .gte("proxima_data", inicioDia.slice(0, 10))
      .lte("proxima_data", proximos7),
    supabase.from("os_itens").select("descricao,quantidade").eq("tipo", "servico"),
  ]);

  const faturamentoDia = (finDia.data ?? []).reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
  const receitasMes = (finMes.data ?? []).filter((r: any) => r.tipo === "receita");
  const faturamentoMes = receitasMes.reduce((s: number, r: any) => s + Number(r.valor || 0), 0);

  // semana: agrega por dia da semana
  const diasLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const semana: { d: string; v: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoje.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const v = (finSemana.data ?? [])
      .filter((r: any) => r.data_pagamento === key)
      .reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
    semana.push({ d: diasLabels[d.getDay()], v });
  }

  const osAbertas = (os.data ?? []).filter((o: any) => o.status === "aberta" || o.status === "aguardando_aprovacao").length;
  const osAguardandoAprov = (os.data ?? []).filter((o: any) => o.status === "aguardando_aprovacao").length;
  const veiculosAtend = (osAtend.data ?? []).length;

  const itensBaixos = (estoque.data ?? []).filter((i: any) => Number(i.quantidade) <= Number(i.qtd_minima));

  const servCount: Record<string, number> = {};
  for (const it of osTopServ.data ?? []) {
    const k = (it.descricao || "").trim();
    if (!k) continue;
    servCount[k] = (servCount[k] || 0) + Number(it.quantidade || 1);
  }
  const topServicos = Object.entries(servCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, v]) => ({ name, v }));

  return {
    faturamentoDia,
    faturamentoMes,
    osAbertas,
    osAguardandoAprov,
    veiculosAtend,
    semana,
    topServicos,
    estoqueBaixoQtd: itensBaixos.length,
    proximasTrocas: (trocas.data ?? []).length,
  };
});