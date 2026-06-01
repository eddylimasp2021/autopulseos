import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const StatusEnum = z.enum(["aberta", "em_andamento", "aguardando_peca", "concluida", "cancelada", "entregue"]);

const ItemInput = z.object({
  descricao: z.string().trim().min(1).max(200),
  tipo: z.enum(["servico", "peca"]),
  quantidade: z.coerce.number().positive().max(99999),
  valor_unit: z.coerce.number().min(0).max(9999999),
  estoque_item_id: z.string().uuid().optional().nullable(),
});

const OSInput = z.object({
  cliente_id: z.string().uuid(),
  veiculo_id: z.string().uuid(),
  descricao: z.string().trim().max(2000).optional().nullable(),
  diagnostico: z.string().trim().max(2000).optional().nullable(),
  km_entrada: z.coerce.number().int().min(0).max(9999999).optional().nullable(),
  desconto: z.coerce.number().min(0).max(9999999).default(0),
  itens: z.array(ItemInput).default([]),
  elevador: z.number().int().min(1).max(7).optional().nullable(),
});
export type OSInputType = z.infer<typeof OSInput>;

export const listOrdens = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data, error } = await supabase
    .from("ordens_servico")
    .select(`id,numero,status,descricao,valor_total,desconto,data_abertura,data_conclusao,elevador,
             clientes(nome,telefone),veiculos(placa,marca,modelo)`)
    .order("data_abertura", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getOrdem = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: os, error } = await supabase
      .from("ordens_servico")
      .select(`*,clientes(nome,telefone,email),veiculos(placa,marca,modelo,ano)`)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!os) return null;
    const { data: itens } = await supabase.from("os_itens").select("*").eq("os_id", data.id);
    return { ...os, itens: itens ?? [] };
  });

export const createOrdem = createServerFn({ method: "POST" })
  .inputValidator((d: OSInputType) => OSInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const valor_total = data.itens.reduce((s, i) => s + i.quantidade * i.valor_unit, 0);
    const { data: os, error } = await supabase
      .from("ordens_servico")
      .insert({
        cliente_id: data.cliente_id,
        veiculo_id: data.veiculo_id,
        descricao: data.descricao ?? null,
        diagnostico: data.diagnostico ?? null,
        km_entrada: data.km_entrada ?? null,
        desconto: data.desconto ?? 0,
        valor_total,
        status: data.elevador ? "em_andamento" : "aberta",
        elevador: data.elevador ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (data.itens.length > 0) {
      const payload = data.itens.map((it) => ({
        os_id: os.id,
        workshop_id: os.workshop_id,
        descricao: it.descricao,
        tipo: it.tipo,
        quantidade: it.quantidade,
        valor_unit: it.valor_unit,
        estoque_item_id: it.estoque_item_id ?? null,
      }));
      const { error: e2 } = await supabase.from("os_itens").insert(payload);
      if (e2) throw new Error(e2.message);
    }
    return os;
  });

export const updateOrdemStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: z.infer<typeof StatusEnum> }) =>
    z.object({ id: z.string().uuid(), status: StatusEnum }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: row, error } = await supabase
      .from("ordens_servico")
      .update({ status: data.status })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteOrdem = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await supabase.from("os_itens").delete().eq("os_id", data.id);
    const { error } = await supabase.from("ordens_servico").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateOrdemElevador = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; elevador: number | null }) =>
    z.object({ id: z.string().uuid(), elevador: z.number().int().min(1).max(7).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: row, error } = await supabase
      .from("ordens_servico")
      .update({ 
        elevador: data.elevador,
        status: data.elevador ? "em_andamento" : "aberta"
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const addOSItem = createServerFn({ method: "POST" })
  .inputValidator((d: {
    os_id: string;
    tipo: "servico" | "peca";
    descricao: string;
    quantidade: number;
    valor_unit: number;
    estoque_item_id?: string | null;
  }) => z.object({
    os_id: z.string().uuid(),
    tipo: z.enum(["servico", "peca"]),
    descricao: z.string().trim().min(1).max(200),
    quantidade: z.coerce.number().positive(),
    valor_unit: z.coerce.number().min(0),
    estoque_item_id: z.string().uuid().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    // 1. Insere o item
    const { data: item, error: errInsert } = await supabase
      .from("os_itens")
      .insert({
        os_id: data.os_id,
        tipo: data.tipo,
        descricao: data.descricao,
        quantidade: data.quantidade,
        valor_unit: data.valor_unit,
        estoque_item_id: data.estoque_item_id || null,
      })
      .select()
      .single();
      
    if (errInsert) throw new Error(errInsert.message);
    
    // 2. Recalcula o valor total da OS
    const { data: itens, error: errFetch } = await supabase
      .from("os_itens")
      .select("quantidade,valor_unit")
      .eq("os_id", data.os_id);
      
    if (errFetch) throw new Error(errFetch.message);
    
    const valor_total = (itens ?? []).reduce((s: number, it: any) => s + Number(it.quantidade) * Number(it.valor_unit), 0);
    
    const { error: errUpdate } = await supabase
      .from("ordens_servico")
      .update({ valor_total })
      .eq("id", data.os_id);
      
    if (errUpdate) throw new Error(errUpdate.message);
    
    return item;
  });

export const removeOSItem = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; os_id: string }) =>
    z.object({ id: z.string().uuid(), os_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    // 1. Deleta o item
    const { error: errDelete } = await supabase
      .from("os_itens")
      .delete()
      .eq("id", data.id);
      
    if (errDelete) throw new Error(errDelete.message);
    
    // 2. Recalcula o valor total da OS
    const { data: itens, error: errFetch } = await supabase
      .from("os_itens")
      .select("quantidade,valor_unit")
      .eq("os_id", data.os_id);
      
    if (errFetch) throw new Error(errFetch.message);
    
    const valor_total = (itens ?? []).reduce((s: number, it: any) => s + Number(it.quantidade) * Number(it.valor_unit), 0);
    
    const { error: errUpdate } = await supabase
      .from("ordens_servico")
      .update({ valor_total })
      .eq("id", data.os_id);
      
    if (errUpdate) throw new Error(errUpdate.message);
    
    return { ok: true };
  });

export const updateOSItem = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; os_id: string; quantidade: number }) =>
    z.object({ id: z.string().uuid(), os_id: z.string().uuid(), quantidade: z.coerce.number().positive() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    // 1. Atualiza o item
    const { data: item, error: errUpdateItem } = await supabase
      .from("os_itens")
      .update({ quantidade: data.quantidade })
      .eq("id", data.id)
      .select()
      .single();
      
    if (errUpdateItem) throw new Error(errUpdateItem.message);
    
    // 2. Recalcula o valor total da OS
    const { data: itens, error: errFetch } = await supabase
      .from("os_itens")
      .select("quantidade,valor_unit")
      .eq("os_id", data.os_id);
      
    if (errFetch) throw new Error(errFetch.message);
    
    const valor_total = (itens ?? []).reduce((s: number, it: any) => s + Number(it.quantidade) * Number(it.valor_unit), 0);
    
    const { error: errUpdate } = await supabase
      .from("ordens_servico")
      .update({ valor_total })
      .eq("id", data.os_id);
      
    if (errUpdate) throw new Error(errUpdate.message);
    
    return item;
  });