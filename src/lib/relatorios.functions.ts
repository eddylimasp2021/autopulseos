import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RangeInput = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});
export type RangeInputType = z.infer<typeof RangeInput>;

export const getResumo = createServerFn({ method: "POST" })
  .inputValidator((d: RangeInputType) => RangeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const [fin, os, cli, est] = await Promise.all([
      supabase
        .from("financeiro_lancamentos")
        .select("tipo,valor,status,data_vencimento")
        .gte("data_vencimento", data.from)
        .lte("data_vencimento", data.to),
      supabase
        .from("ordens_servico")
        .select("id,status,valor_total,desconto,created_at")
        .gte("created_at", data.from)
        .lte("created_at", data.to + "T23:59:59"),
      supabase.from("clientes").select("id,created_at"),
      supabase.from("estoque_itens").select("id,nome,quantidade,qtd_minima,ativo"),
    ]);
    if (fin.error) throw new Error(fin.error.message);
    if (os.error) throw new Error(os.error.message);
    if (cli.error) throw new Error(cli.error.message);
    if (est.error) throw new Error(est.error.message);

    const receitas = (fin.data ?? []).filter((r: any) => r.tipo === "receita");
    const despesas = (fin.data ?? []).filter((r: any) => r.tipo === "despesa");
    const totalReceita = receitas.reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
    const totalDespesa = despesas.reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
    const receitaPaga = receitas.filter((r: any) => r.status === "pago").reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
    const aReceber = receitas.filter((r: any) => r.status !== "pago" && r.status !== "cancelado").reduce((s: number, r: any) => s + Number(r.valor || 0), 0);

    const osPorStatus: Record<string, { qtd: number; valor: number }> = {};
    for (const o of os.data ?? []) {
      const k = o.status as string;
      if (!osPorStatus[k]) osPorStatus[k] = { qtd: 0, valor: 0 };
      osPorStatus[k].qtd += 1;
      osPorStatus[k].valor += Number(o.valor_total || 0) - Number(o.desconto || 0);
    }

    const novosClientes = (cli.data ?? []).filter(
      (c: any) => c.created_at >= data.from && c.created_at <= data.to + "T23:59:59",
    ).length;

    const estoqueBaixo = (est.data ?? [])
      .filter((i: any) => i.ativo && Number(i.quantidade) <= Number(i.qtd_minima))
      .map((i: any) => ({ id: i.id, nome: i.nome, quantidade: Number(i.quantidade), qtd_minima: Number(i.qtd_minima) }));

    return {
      financeiro: { totalReceita, totalDespesa, receitaPaga, aReceber, saldo: totalReceita - totalDespesa },
      os: { total: (os.data ?? []).length, porStatus: osPorStatus },
      clientes: { total: (cli.data ?? []).length, novos: novosClientes },
      estoqueBaixo,
    };
  });

export const exportLancamentos = createServerFn({ method: "POST" })
  .inputValidator((d: RangeInputType) => RangeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: rows, error } = await supabase
      .from("financeiro_lancamentos")
      .select("data_vencimento,data_pagamento,tipo,categoria,descricao,valor,status,forma_pagamento")
      .gte("data_vencimento", data.from)
      .lte("data_vencimento", data.to)
      .order("data_vencimento", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const exportOrdens = createServerFn({ method: "POST" })
  .inputValidator((d: RangeInputType) => RangeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: rows, error } = await supabase
      .from("ordens_servico")
      .select("numero,status,valor_total,desconto,data_abertura,data_conclusao,clientes(nome),veiculos(placa,marca,modelo)")
      .gte("created_at", data.from)
      .lte("created_at", data.to + "T23:59:59")
      .order("numero", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });