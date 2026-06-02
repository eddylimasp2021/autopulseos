import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";


export const FornecedorInputSchema = z.object({
  id: z.string().uuid().optional(),
  nome_fantasia: z.string().trim().min(1, "O nome fantasia é obrigatório"),
  razao_social: z.string().trim().optional().nullable(),
  cnpj_cpf: z.string().trim().optional().nullable(),
  inscricao_estadual: z.string().trim().optional().nullable(),
  email: z.string().trim().email("E-mail inválido").optional().nullable().or(z.literal("")),
  telefone: z.string().trim().optional().nullable(),
  celular: z.string().trim().optional().nullable(),
  cep: z.string().trim().optional().nullable(),
  endereco: z.string().trim().optional().nullable(),
  numero: z.string().trim().optional().nullable(),
  bairro: z.string().trim().optional().nullable(),
  cidade: z.string().trim().optional().nullable(),
  estado: z.string().trim().optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(["ativo", "inativo"]).default("ativo"),
});

export type FornecedorInput = z.infer<typeof FornecedorInputSchema>;

export const listFornecedores = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("fornecedores")
      .select("*")
      .order("nome_fantasia", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getFornecedor = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: fornecedor, error } = await supabase
      .from("fornecedores")
      .select("*")
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);
    return fornecedor;
  });

export const createFornecedor = createServerFn({ method: "POST" })
  .inputValidator((d: FornecedorInput) => FornecedorInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;

    const { data: fornecedor, error } = await supabase
      .from("fornecedores")
      .insert({
        nome_fantasia: data.nome_fantasia,
        razao_social: data.razao_social,
        cnpj_cpf: data.cnpj_cpf,
        inscricao_estadual: data.inscricao_estadual,
        email: data.email,
        telefone: data.telefone,
        celular: data.celular,
        cep: data.cep,
        endereco: data.endereco,
        numero: data.numero,
        bairro: data.bairro,
        cidade: data.cidade,
        estado: data.estado,
        observacoes: data.observacoes,
        status: data.status,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return fornecedor;
  });

export const updateFornecedor = createServerFn({ method: "POST" })
  .inputValidator((d: FornecedorInput) => FornecedorInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    if (!data.id) throw new Error("ID do fornecedor é obrigatório para atualização");

    const { data: fornecedor, error } = await supabase
      .from("fornecedores")
      .update({
        nome_fantasia: data.nome_fantasia,
        razao_social: data.razao_social,
        cnpj_cpf: data.cnpj_cpf,
        inscricao_estadual: data.inscricao_estadual,
        email: data.email,
        telefone: data.telefone,
        celular: data.celular,
        cep: data.cep,
        endereco: data.endereco,
        numero: data.numero,
        bairro: data.bairro,
        cidade: data.cidade,
        estado: data.estado,
        observacoes: data.observacoes,
        status: data.status,
      })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return fornecedor;
  });

export const deleteFornecedor = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("fornecedores")
      .delete()
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

const BulkImportInput = z.array(FornecedorInputSchema);
export type BulkImportInputType = z.infer<typeof BulkImportInput>;

export const bulkImportFornecedores = createServerFn({ method: "POST" })
  .inputValidator((d: BulkImportInputType) => BulkImportInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    // Normalizar dados (cnpj_cpf e email)
    for (const r of data as any[]) {
      if (r.cnpj_cpf) r.cnpj_cpf = String(r.cnpj_cpf).replace(/\D/g, "");
      if (r.cnpj_cpf === "") r.cnpj_cpf = null;
      if (r.email) r.email = String(r.email).trim().toLowerCase();
      if (r.email === "") r.email = null;
    }

    const dedupMapDoc = new Map<string, any>();
    const withoutDoc = [];
    
    for (const r of data) {
      if (r.cnpj_cpf) dedupMapDoc.set(r.cnpj_cpf, r);
      else withoutDoc.push(r);
    }
    
    const dedupedWithDoc = Array.from(dedupMapDoc.values());
    
    let inserted = 0;
    let updated = 0;

    if (dedupedWithDoc.length > 0) {
      const documentos = dedupedWithDoc.map((r) => r.cnpj_cpf);
      const { data: existingRows, error: existingError } = await supabase
        .from("fornecedores")
        .select("id,cnpj_cpf")
        .in("cnpj_cpf", documentos);

      if (existingError) throw new Error(existingError.message);

      const existingByDoc = new Map<string, { id: string }>();
      for (const row of existingRows ?? []) {
        if (row.cnpj_cpf) existingByDoc.set(String(row.cnpj_cpf).replace(/\D/g, ""), row as { id: string });
      }

      const toInsert = dedupedWithDoc.filter((row) => !existingByDoc.has(row.cnpj_cpf));
      const toUpdate = dedupedWithDoc
        .filter((row) => existingByDoc.has(row.cnpj_cpf))
        .map((row) => ({ ...row, id: existingByDoc.get(row.cnpj_cpf)!.id }));

      if (toInsert.length > 0) {
        const { error, count } = await supabase.from("fornecedores").insert(toInsert, { count: "exact" });
        if (error) throw new Error(error.message);
        inserted += count ?? toInsert.length;
      }

      for (const row of toUpdate) {
        const { id, ...payload } = row;
        const { error } = await supabase.from("fornecedores").update(payload).eq("id", id);
        if (error) throw new Error(error.message);
      }
      updated += toUpdate.length;
    }

    if (withoutDoc.length > 0) {
      const { error, count } = await supabase.from("fornecedores").insert(withoutDoc, { count: "exact" });
      if (error) throw new Error(error.message);
      inserted += count ?? withoutDoc.length;
    }

    return {
      ok: true,
      processados: data.length,
      inseridos: inserted,
      atualizados: updated,
    };
  });
