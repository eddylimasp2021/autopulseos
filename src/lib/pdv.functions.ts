import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Item = z.object({
  estoque_item_id: z.string().uuid().nullable().optional(),
  descricao: z.string().trim().min(1).max(200),
  quantidade: z.coerce.number().min(-99999).max(99999),
  valor_unit: z.coerce.number().min(0).max(99999999),
});

const FinalizarInput = z.object({
  cliente_id: z.string().uuid().nullable().optional(),
  caixa_id: z.string().uuid(),
  pagamentos: z.array(z.object({
    forma: z.enum(["pix", "dinheiro", "cartao_credito", "cartao_debito"]),
    valor: z.coerce.number()
  })).min(1),
  valor_recebido: z.coerce.number().min(0).max(99999999).optional().nullable(),
  desconto: z.coerce.number().min(0).max(99999999).optional().nullable(),
  observacao: z.string().trim().max(500).optional().nullable(),
  itens: z.array(Item).min(1).max(200),
});
export type FinalizarInputType = z.infer<typeof FinalizarInput>;

export const listEstoqueParaPDV = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data, error } = await supabase
    .from("estoque_itens")
    .select("id,nome,categoria,preco_venda,quantidade,unidade,codigo")
    .eq("ativo", true)
    .order("nome", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const finalizarVenda = createServerFn({ method: "POST" })
  .inputValidator((d: FinalizarInputType) => FinalizarInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const subtotal = data.itens.reduce((s, i) => s + (i.quantidade * i.valor_unit), 0);
    const desconto = Number(data.desconto ?? 0);
    const total = subtotal - desconto;
    const isDevolucao = total < 0;
    const hoje = new Date().toISOString().slice(0, 10);

    const descBase = `Venda PDV (${data.itens.length} ${data.itens.length === 1 ? "item" : "itens"})`;
    const descricao = data.observacao ? `${descBase} | ${data.observacao}` : descBase;

    const lancamentosAInserir = data.pagamentos.filter(p => p.valor !== 0).map(p => ({
        tipo: p.valor < 0 ? "despesa" : "receita",
        categoria: p.valor < 0 ? "Devolução PDV" : "PDV",
        descricao,
        valor: Math.abs(p.valor),
        data_vencimento: hoje,
        data_pagamento: hoje,
        status: "pago",
        forma_pagamento: p.forma,
        cliente_id: data.cliente_id ?? null,
        caixa_id: data.caixa_id,
    }));

    if (lancamentosAInserir.length === 0) {
      throw new Error("Nenhum pagamento válido informado.");
    }

    const { data: lancs, error: e1 } = await supabase
      .from("financeiro_lancamentos")
      .insert(lancamentosAInserir)
      .select();
    if (e1) throw new Error(e1.message);

    // Baixa estoque para itens cadastrados
    for (const it of data.itens) {
      if (it.estoque_item_id) {
        const { error: em } = await supabase.from("estoque_movimentacoes").insert({
          item_id: it.estoque_item_id,
          tipo: it.quantidade < 0 ? "entrada" : "saida",
          quantidade: Math.abs(it.quantidade),
          motivo: `PDV ${lancs[0]?.id?.slice(0, 8) || 'Devolução'}`,
        });
        if (em) throw new Error(em.message);
      }
    }
    
    const pagDinheiro = data.pagamentos.find(p => p.forma === "dinheiro");
    const troco = !isDevolucao && pagDinheiro && data.valor_recebido != null
      ? Math.max(0, Number(data.valor_recebido) - pagDinheiro.valor)
      : 0;
      
    return { ok: true, total, subtotal, desconto, troco, lancamentos_ids: lancs.map((l:any) => l.id) };
  });

export const verificarCaixaAberto = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data, error } = await supabase
    .from("pdv_caixas")
    .select("*")
    .eq("status", "aberto")
    .limit(1)
    .single();
    
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data || null;
});

const AbrirCaixaInput = z.object({
  saldo_abertura: z.coerce.number().min(0),
});

export const abrirCaixa = createServerFn({ method: "POST" })
  .inputValidator((d: any) => AbrirCaixaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: userResp } = await supabase.auth.getUser();
    const operador_nome = userResp?.user?.user_metadata?.nome || userResp?.user?.email?.split('@')[0] || "Operador";
    
    const { data: existente } = await supabase.from("pdv_caixas").select("id").eq("status", "aberto").limit(1).single();
    if (existente) throw new Error("Já existe um caixa aberto nesta oficina.");

    const { data: novo, error } = await supabase.from("pdv_caixas").insert({
      operador_nome,
      saldo_abertura: data.saldo_abertura
    }).select().single();

    if (error) throw new Error(error.message);
    return novo;
  });

const FecharCaixaInput = z.object({
  caixa_id: z.string().uuid(),
  saldo_dinheiro_informado: z.coerce.number().min(0).default(0)
});

export const fecharCaixa = createServerFn({ method: "POST" })
  .inputValidator((d: any) => FecharCaixaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    const { data: lancamentos, error: errLanc } = await supabase
      .from("financeiro_lancamentos")
      .select("valor, forma_pagamento")
      .eq("caixa_id", data.caixa_id);
    if (errLanc) throw new Error(errLanc.message);

    let totalDinheiro = 0, totalPix = 0, totalCredito = 0, totalDebito = 0;
    for (const l of (lancamentos || [])) {
      if (l.forma_pagamento === "dinheiro") totalDinheiro += Number(l.valor);
      else if (l.forma_pagamento === "pix") totalPix += Number(l.valor);
      else if (l.forma_pagamento === "cartao_debito") totalDebito += Number(l.valor);
      else totalCredito += Number(l.valor); // "cartao_credito" ou antigo "cartao"
    }
    const totalGeral = totalDinheiro + totalPix + totalCredito + totalDebito;

    const { data: caixa, error } = await supabase
      .from("pdv_caixas")
      .update({
        status: "fechado",
        saldo_fechamento: totalGeral,
        observacoes: JSON.stringify({ saldo_dinheiro_informado: data.saldo_dinheiro_informado }),
        data_fechamento: new Date().toISOString()
      })
      .eq("id", data.caixa_id)
      .eq("status", "aberto")
      .select()
      .single();

    if (error) throw new Error(error.message);
    
    let saldoDinheiroInformado = 0;
    try {
      if (caixa.observacoes) {
        const parsed = JSON.parse(caixa.observacoes);
        saldoDinheiroInformado = parsed.saldo_dinheiro_informado ?? 0;
      }
    } catch (e) {
      // Ignorar se não for JSON
    }

    return { 
      ...caixa,
      saldo_dinheiro_informado: saldoDinheiroInformado,
      resumo: { dinheiro: totalDinheiro, pix: totalPix, credito: totalCredito, debito: totalDebito, total_vendas: totalGeral }
    };
  });

export const getResumoCaixa = createServerFn({ method: "POST" })
  .inputValidator((d: any) => FecharCaixaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    // Obter caixa
    const { data: caixa, error: errCaixa } = await supabase
      .from("pdv_caixas")
      .select("saldo_abertura")
      .eq("id", data.caixa_id)
      .single();
    if (errCaixa) throw new Error(errCaixa.message);

    const { data: lancamentos, error: errLanc } = await supabase
      .from("financeiro_lancamentos")
      .select("valor, forma_pagamento")
      .eq("caixa_id", data.caixa_id);
    if (errLanc) throw new Error(errLanc.message);

    let totalDinheiro = 0, totalPix = 0, totalCredito = 0, totalDebito = 0;
    for (const l of (lancamentos || [])) {
      if (l.forma_pagamento === "dinheiro") totalDinheiro += Number(l.valor);
      else if (l.forma_pagamento === "pix") totalPix += Number(l.valor);
      else if (l.forma_pagamento === "cartao_debito") totalDebito += Number(l.valor);
      else totalCredito += Number(l.valor);
    }
    
    const totalVendas = totalDinheiro + totalPix + totalCredito + totalDebito;
    
    return {
      saldo_abertura: Number(caixa.saldo_abertura),
      dinheiro: totalDinheiro,
      pix: totalPix,
      credito: totalCredito,
      debito: totalDebito,
      total_vendas: totalVendas,
      total_geral: totalVendas + Number(caixa.saldo_abertura)
    };
  });

const SangriaReforcoInput = z.object({
  caixa_id: z.string().uuid(),
  valor: z.coerce.number().min(0.01),
  observacao: z.string().trim().min(1).max(200),
});

export const registrarSangria = createServerFn({ method: "POST" })
  .inputValidator((d: any) => SangriaReforcoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const hoje = new Date().toISOString().slice(0, 10);
    
    const { data: lanc, error } = await supabase.from("financeiro_lancamentos").insert({
      tipo: "despesa",
      categoria: "Sangria PDV",
      descricao: `Sangria: ${data.observacao}`,
      valor: data.valor,
      data_vencimento: hoje,
      data_pagamento: hoje,
      status: "pago",
      forma_pagamento: "dinheiro",
      caixa_id: data.caixa_id,
    }).select().single();

    if (error) throw new Error(error.message);
    return lanc;
  });

export const registrarReforco = createServerFn({ method: "POST" })
  .inputValidator((d: any) => SangriaReforcoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const hoje = new Date().toISOString().slice(0, 10);
    
    const { data: lanc, error } = await supabase.from("financeiro_lancamentos").insert({
      tipo: "receita",
      categoria: "Reforço PDV",
      descricao: `Reforço: ${data.observacao}`,
      valor: data.valor,
      data_vencimento: hoje,
      data_pagamento: hoje,
      status: "pago",
      forma_pagamento: "dinheiro",
      caixa_id: data.caixa_id,
    }).select().single();

    if (error) throw new Error(error.message);
    return lanc;
  });

export const listVendasCaixa = createServerFn({ method: "GET" })
  .validator((caixa_id: string) => caixa_id)
  .handler(async ({ data: caixa_id, context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("financeiro_lancamentos")
      .select("*")
      .eq("caixa_id", caixa_id)
      .eq("categoria", "PDV")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const estornarVenda = createServerFn({ method: "POST" })
  .validator((lancamento_id: string) => lancamento_id)
  .handler(async ({ data: lancamento_id, context }) => {
    const { supabase } = context as any;
    
    const { data: lancOriginal, error: errBusca } = await supabase
      .from("financeiro_lancamentos")
      .select("*")
      .eq("id", lancamento_id)
      .single();
      
    if (errBusca) throw new Error(errBusca.message);
    if (lancOriginal.categoria !== "PDV") throw new Error("Apenas vendas de PDV podem ser estornadas por aqui.");
    if (lancOriginal.descricao.includes("[ESTORNADA]")) throw new Error("Esta venda já foi estornada.");

    await supabase.from("financeiro_lancamentos").update({
      descricao: `[ESTORNADA] ${lancOriginal.descricao}`
    }).eq("id", lancamento_id);

    const hoje = new Date().toISOString().slice(0, 10);
    const { error: errEstorno } = await supabase.from("financeiro_lancamentos").insert({
      tipo: "despesa",
      categoria: "Estorno PDV",
      descricao: `Estorno Ref: ${lancamento_id.slice(0, 8)}`,
      valor: lancOriginal.valor,
      data_vencimento: hoje,
      data_pagamento: hoje,
      status: "pago",
      forma_pagamento: lancOriginal.forma_pagamento,
      caixa_id: lancOriginal.caixa_id,
    });
    if (errEstorno) throw new Error(errEstorno.message);

    const motivoBusca = `PDV ${lancamento_id.slice(0, 8)}`;
    const { data: movs } = await supabase.from("estoque_movimentacoes")
      .select("*")
      .like("motivo", `${motivoBusca}%`);

    if (movs && movs.length > 0) {
      for (const m of movs) {
        if (m.tipo === "saida") {
          await supabase.from("estoque_movimentacoes").insert({
            item_id: m.item_id,
            tipo: "entrada",
            quantidade: m.quantidade,
            motivo: `Estorno PDV ${lancamento_id.slice(0, 8)}`
          });
        }
      }
    }
    
    return { success: true };
  });