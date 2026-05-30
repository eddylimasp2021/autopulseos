import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Item = z.object({
  estoque_item_id: z.string().uuid().nullable().optional(),
  descricao: z.string().trim().min(1).max(200),
  quantidade: z.coerce.number().min(0.001).max(99999),
  valor_unit: z.coerce.number().min(0).max(99999999),
});

const FinalizarInput = z.object({
  cliente_id: z.string().uuid().nullable().optional(),
  forma_pagamento: z.enum(["pix", "dinheiro", "cartao_credito", "cartao_debito"]),
  desconto: z.coerce.number().min(0).max(99999999).optional().default(0),
  valor_recebido: z.coerce.number().min(0).max(99999999).optional().nullable(),
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
    const subtotal = data.itens.reduce((s, i) => s + i.quantidade * i.valor_unit, 0);
    const desconto = Number(data.desconto ?? 0);
    const total = Math.max(0, subtotal - desconto);
    const hoje = new Date().toISOString().slice(0, 10);

    const formaLabel: Record<string, string> = {
      pix: "PIX",
      dinheiro: "Dinheiro",
      cartao_credito: "Cartão de crédito",
      cartao_debito: "Cartão de débito",
    };
    const descBase = `Venda PDV (${data.itens.length} ${data.itens.length === 1 ? "item" : "itens"}) — ${formaLabel[data.forma_pagamento]}`;
    const descricao = data.observacao ? `${descBase} | ${data.observacao}` : descBase;

    const { data: lanc, error: e1 } = await supabase
      .from("financeiro_lancamentos")
      .insert({
        tipo: "receita",
        categoria: "PDV",
        descricao,
        valor: total,
        data_vencimento: hoje,
        data_pagamento: hoje,
        status: "pago",
        forma_pagamento: data.forma_pagamento === "cartao_credito" || data.forma_pagamento === "cartao_debito" ? "cartao" : data.forma_pagamento,
        cliente_id: data.cliente_id ?? null,
      })
      .select()
      .single();
    if (e1) throw new Error(e1.message);

    // Baixa estoque para itens cadastrados
    for (const it of data.itens) {
      if (it.estoque_item_id) {
        const { error: em } = await supabase.from("estoque_movimentacoes").insert({
          item_id: it.estoque_item_id,
          tipo: "saida",
          quantidade: it.quantidade,
          motivo: `PDV ${lanc.id.slice(0, 8)}`,
        });
        if (em) throw new Error(em.message);
      }
    }
    const troco = data.forma_pagamento === "dinheiro" && data.valor_recebido != null
      ? Math.max(0, Number(data.valor_recebido) - total)
      : 0;
    return { ok: true, total, subtotal, desconto, troco, lancamento_id: lanc.id };
  });