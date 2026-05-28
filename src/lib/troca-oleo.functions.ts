import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  cliente_id: z.string().uuid(),
  veiculo_id: z.string().uuid(),
  data: z.string().min(1),
  km_atual: z.coerce.number().int().min(0).max(9999999).optional().nullable(),
  km_proxima: z.coerce.number().int().min(0).max(9999999).optional().nullable(),
  oleo_tipo: z.string().trim().max(80).optional().nullable(),
  oleo_marca: z.string().trim().max(80).optional().nullable(),
  filtro_oleo: z.string().trim().max(80).optional().nullable(),
  filtro_ar: z.string().trim().max(80).optional().nullable(),
  filtro_combustivel: z.string().trim().max(80).optional().nullable(),
  proxima_data: z.string().optional().nullable(),
  status: z.enum(["agendada", "em_andamento", "realizado", "cancelado"]).default("realizado"),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});
export type TrocaOleoInputType = z.infer<typeof Input>;

function clean<T extends Record<string, any>>(o: T) {
  const out: Record<string, any> = {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  return out;
}

export const listTrocas = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data, error } = await supabase
    .from("troca_oleo")
    .select("id,data,km_atual,km_proxima,oleo_tipo,oleo_marca,filtro_oleo,proxima_data,status,clientes(nome),veiculos(placa,marca,modelo)")
    .order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createTroca = createServerFn({ method: "POST" })
  .inputValidator((d: TrocaOleoInputType) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: row, error } = await supabase.from("troca_oleo").insert(clean(data)).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateTrocaStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: "agendada" | "em_andamento" | "realizado" | "cancelado" }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["agendada", "em_andamento", "realizado", "cancelado"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("troca_oleo").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTroca = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("troca_oleo").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });