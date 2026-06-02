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
