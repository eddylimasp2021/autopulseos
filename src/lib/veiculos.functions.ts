import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VeiculoInput = z.object({
  cliente_id: z.string().uuid(),
  placa: z.string().trim().min(1).max(10),
  marca: z.string().trim().max(60).optional().nullable(),
  modelo: z.string().trim().max(80).optional().nullable(),
  ano: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  cor: z.string().trim().max(40).optional().nullable(),
  combustivel: z.string().trim().max(40).optional().nullable(),
  km_atual: z.coerce.number().int().min(0).max(9999999).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});
export type VeiculoInputType = z.infer<typeof VeiculoInput>;

function clean<T extends Record<string, any>>(o: T) {
  const out: Record<string, any> = {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  return out;
}

export const listVeiculos = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data, error } = await supabase
    .from("veiculos")
    .select("id,cliente_id,placa,marca,modelo,ano,cor,km_atual,created_at,clientes(nome)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createVeiculo = createServerFn({ method: "POST" })
  .inputValidator((d: VeiculoInputType) => VeiculoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const payload = { ...clean(data), placa: data.placa.toUpperCase().trim() };
    const { data: row, error } = await supabase.from("veiculos").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateVeiculo = createServerFn({ method: "POST" })
  .inputValidator((d: VeiculoInputType & { id: string }) =>
    VeiculoInput.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { id, ...rest } = data;
    const payload = { ...clean(rest), placa: rest.placa.toUpperCase().trim() };
    const { data: row, error } = await supabase.from("veiculos").update(payload).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteVeiculo = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("veiculos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });