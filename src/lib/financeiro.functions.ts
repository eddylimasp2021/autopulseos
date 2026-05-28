import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LancInput = z.object({
  tipo: z.enum(["receita", "despesa"]),
  categoria: z.string().trim().max(80).optional().nullable(),
  descricao: z.string().trim().min(1).max(200),
  valor: z.coerce.number().min(0).max(99999999),
  data_vencimento: z.string().min(1),
  data_pagamento: z.string().optional().nullable(),
  status: z.enum(["pendente", "pago", "atrasado", "cancelado"]).default("pendente"),
  forma_pagamento: z.string().trim().max(40).optional().nullable(),
  cliente_id: z.string().uuid().optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});
export type LancInputType = z.infer<typeof LancInput>;

function clean<T extends Record<string, any>>(o: T) {
  const out: Record<string, any> = {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  return out;
}

export const listLancamentos = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data, error } = await supabase
    .from("financeiro_lancamentos")
    .select("id,tipo,categoria,descricao,valor,data_vencimento,data_pagamento,status,forma_pagamento,clientes(nome),created_at")
    .order("data_vencimento", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createLancamento = createServerFn({ method: "POST" })
  .inputValidator((d: LancInputType) => LancInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: row, error } = await supabase.from("financeiro_lancamentos").insert(clean(data)).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateLancamentoStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: "pendente" | "pago" | "atrasado" | "cancelado" }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["pendente", "pago", "atrasado", "cancelado"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const patch: any = { status: data.status };
    if (data.status === "pago") patch.data_pagamento = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("financeiro_lancamentos").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLancamento = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("financeiro_lancamentos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });