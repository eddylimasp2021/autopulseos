import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ItemInput = z.object({
  nome: z.string().trim().min(1).max(160),
  codigo: z.string().trim().max(60).optional().nullable(),
  categoria: z.string().trim().max(60).optional().nullable(),
  unidade: z.string().trim().max(10).optional().nullable(),
  quantidade: z.coerce.number().min(-9999999).max(9999999).default(0),
  qtd_minima: z.coerce.number().min(-9999999).max(9999999).default(0),
  preco_custo: z.coerce.number().min(0).max(9999999).default(0),
  preco_venda: z.coerce.number().min(0).max(9999999).default(0),
  fornecedor: z.string().trim().max(120).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});
export type ItemInputType = z.infer<typeof ItemInput>;

function clean<T extends Record<string, any>>(o: T) {
  const out: Record<string, any> = {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  return out;
}

export const listEstoque = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data, error } = await supabase
    .from("estoque_itens")
    .select("id,nome,codigo,categoria,unidade,quantidade,qtd_minima,preco_custo,preco_venda,fornecedor,ativo,created_at")
    .eq("ativo", true)
    .order("nome", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createEstoqueItem = createServerFn({ method: "POST" })
  .inputValidator((d: ItemInputType) => ItemInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: row, error } = await supabase.from("estoque_itens").insert(clean(data)).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateEstoqueItem = createServerFn({ method: "POST" })
  .inputValidator((d: ItemInputType & { id: string }) =>
    ItemInput.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase.from("estoque_itens").update(clean(rest)).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteEstoqueItem = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("estoque_itens").update({ ativo: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const MovInput = z.object({
  item_id: z.string().uuid(),
  tipo: z.enum(["entrada", "saida", "ajuste"]),
  quantidade: z.coerce.number().min(0).max(9999999),
  motivo: z.string().trim().max(200).optional().nullable(),
}).refine(
  (d) => d.tipo === "ajuste" || d.quantidade > 0,
  { message: "Quantidade deve ser maior que zero para entrada/saída", path: ["quantidade"] },
);

export const createMovimentacao = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof MovInput>) => MovInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("estoque_movimentacoes").insert(clean(data));
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BulkImportInput = z.array(ItemInput);
export type BulkImportInputType = z.infer<typeof BulkImportInput>;

export const bulkImportEstoque = createServerFn({ method: "POST" })
  .inputValidator((d: BulkImportInputType) => BulkImportInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const cleanedData = data.map(clean);

    // Normaliza códigos (trim + uppercase) para evitar duplicatas por variação
    for (const r of cleanedData as any[]) {
      if (r.codigo) r.codigo = String(r.codigo).trim().toUpperCase();
      if (r.codigo === "") r.codigo = null;
    }

    // Separa itens com código (passíveis de upsert) dos sem código (insert direto)
    const withCode = (cleanedData as any[]).filter((r) => r.codigo);
    const withoutCode = (cleanedData as any[]).filter((r) => !r.codigo);

    // Dedup local por código (mantém a última ocorrência) para evitar
    // "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const dedupMap = new Map<string, any>();
    for (const r of withCode) dedupMap.set(r.codigo, r);
    const dedupedWithCode = Array.from(dedupMap.values());

    let inserted = 0;
    let updated = 0;

    if (dedupedWithCode.length > 0) {
      // Upsert por (workshop_id, codigo) — atualiza preços/quantidades se já existir
      const { error, count } = await supabase
        .from("estoque_itens")
        .upsert(dedupedWithCode, { onConflict: "workshop_id,codigo", ignoreDuplicates: false, count: "exact" });
      if (error) throw new Error(error.message);
      updated = count ?? dedupedWithCode.length;
    }

    if (withoutCode.length > 0) {
      const { error, count } = await supabase
        .from("estoque_itens")
        .insert(withoutCode, { count: "exact" });
      if (error) throw new Error(error.message);
      inserted = count ?? withoutCode.length;
    }

    return {
      ok: true,
      processados: dedupedWithCode.length + withoutCode.length,
      duplicadosNoArquivo: withCode.length - dedupedWithCode.length,
      inseridos: inserted,
      atualizados: updated,
    };
  });