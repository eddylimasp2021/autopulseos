import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ClienteInput = z.object({
  nome: z.string().trim().min(1).max(120),
  telefone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  documento: z.string().trim().max(30).optional().nullable(),
  endereco: z.string().trim().max(255).optional().nullable(),
  cidade: z.string().trim().max(80).optional().nullable(),
  estado: z.string().trim().max(40).optional().nullable(),
  cep: z.string().trim().max(15).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

export type ClienteInputType = z.infer<typeof ClienteInput>;

function normalize(input: ClienteInputType) {
  const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
  return {
    nome: input.nome.trim(),
    telefone: empty(input.telefone) as string | null,
    email: empty(input.email) as string | null,
    documento: empty(input.documento) as string | null,
    endereco: empty(input.endereco) as string | null,
    cidade: empty(input.cidade) as string | null,
    estado: empty(input.estado) as string | null,
    cep: empty(input.cep) as string | null,
    observacoes: empty(input.observacoes) as string | null,
  };
}

export const listClientes = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data, error } = await supabase
    .from("clientes")
    .select("id,nome,telefone,email,documento,cidade,estado,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getCliente = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: row, error } = await supabase.from("clientes").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const createCliente = createServerFn({ method: "POST" })
  .inputValidator((d: ClienteInputType) => ClienteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: row, error } = await supabase.from("clientes").insert(normalize(data)).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCliente = createServerFn({ method: "POST" })
  .inputValidator((d: ClienteInputType & { id: string }) =>
    ClienteInput.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase.from("clientes").update(normalize(rest)).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCliente = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("clientes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BulkImportInput = z.array(ClienteInput);
export type BulkImportInputType = z.infer<typeof BulkImportInput>;

export const bulkImportClientes = createServerFn({ method: "POST" })
  .inputValidator((d: BulkImportInputType) => BulkImportInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const cleanedData = data.map((item) => normalize(item));

    // Normaliza documento e email para evitar duplicatas por variação
    for (const r of cleanedData as any[]) {
      if (r.documento) r.documento = String(r.documento).replace(/\D/g, "");
      if (r.documento === "") r.documento = null;
      if (r.email) r.email = String(r.email).trim().toLowerCase();
      if (r.email === "") r.email = null;
    }

    // Dedup local por documento
    const dedupMapDoc = new Map<string, any>();
    const withoutDoc = [];
    
    for (const r of cleanedData) {
      if (r.documento) dedupMapDoc.set(r.documento, r);
      else withoutDoc.push(r);
    }
    
    const dedupedWithDoc = Array.from(dedupMapDoc.values());
    
    let inserted = 0;
    let updated = 0;

    // Lida com os clientes com documento (CPF/CNPJ) -> Upsert
    if (dedupedWithDoc.length > 0) {
      const documentos = dedupedWithDoc.map((r) => r.documento);
      const { data: existingRows, error: existingError } = await supabase
        .from("clientes")
        .select("id,documento")
        .in("documento", documentos);

      if (existingError) throw new Error(existingError.message);

      const existingByDoc = new Map<string, { id: string }>();
      for (const row of existingRows ?? []) {
        if (row.documento) existingByDoc.set(String(row.documento).replace(/\D/g, ""), row as { id: string });
      }

      const toInsert = dedupedWithDoc.filter((row) => !existingByDoc.has(row.documento));
      const toUpdate = dedupedWithDoc
        .filter((row) => existingByDoc.has(row.documento))
        .map((row) => ({ ...row, id: existingByDoc.get(row.documento)!.id }));

      if (toInsert.length > 0) {
        const { error, count } = await supabase.from("clientes").insert(toInsert, { count: "exact" });
        if (error) throw new Error(error.message);
        inserted += count ?? toInsert.length;
      }

      for (const row of toUpdate) {
        const { id, ...payload } = row;
        const { error } = await supabase.from("clientes").update(payload).eq("id", id);
        if (error) throw new Error(error.message);
      }
      updated += toUpdate.length;
    }

    // Lida com os clientes sem documento -> apenas insert (aqui poderíamos checar por email, mas mantemos simples)
    if (withoutDoc.length > 0) {
      const { error, count } = await supabase.from("clientes").insert(withoutDoc, { count: "exact" });
      if (error) throw new Error(error.message);
      inserted += count ?? withoutDoc.length;
    }

    return {
      ok: true,
      processados: cleanedData.length,
      inseridos: inserted,
      atualizados: updated,
    };
  });