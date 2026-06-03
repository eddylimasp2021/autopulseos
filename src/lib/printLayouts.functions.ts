import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PrintLayout = {
  id: string;
  workshop_id: string;
  nome: string;
  tipo_cupom: 'venda' | 'abertura_caixa' | 'fechamento_caixa' | 'os';
  template_base: 'detalhado' | 'minimalista' | 'logo_grande' | 'compacto';
  largura_papel: '58mm' | '80mm';
  tamanho_fonte: 'pequena' | 'normal' | 'grande';
  espacamento: 'compacto' | 'normal' | 'largo';
  cabecalho: string | null;
  rodape: string | null;
  mostrar_logo: boolean;
  mostrar_endereco: boolean;
  mostrar_telefone: boolean;
  mostrar_rodape: boolean;
  mostrar_obs: boolean;
  is_padrao: boolean;
  created_at: string;
  updated_at: string;
};

// Helper inside the functions to get the workshop_id safely
async function getWorkshopId(supabase: any) {
  const { data: member } = await supabase
    .from("workshop_members")
    .select("workshop_id")
    .limit(1)
    .single();
  return member?.workshop_id;
}

export const listPrintLayouts = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const workshop_id = await getWorkshopId(supabase);
  if (!workshop_id) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("print_layouts")
    .select("*")
    .eq("workshop_id", workshop_id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as PrintLayout[];
});

export const getPrintLayout = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id, context }) => {
    const { supabase } = context as any;
    const workshop_id = await getWorkshopId(supabase);
    if (!workshop_id) throw new Error("Não autenticado");

    const { data, error } = await supabase
      .from("print_layouts")
      .select("*")
      .eq("id", id)
      .eq("workshop_id", workshop_id)
      .single();

    if (error) throw error;
    return data as PrintLayout;
});

export const createPrintLayout = createServerFn({ method: "POST" })
  .inputValidator((layout: Omit<PrintLayout, "id" | "workshop_id" | "created_at" | "updated_at">) => layout)
  .handler(async ({ data: layout, context }) => {
    const { supabase } = context as any;
    const workshop_id = await getWorkshopId(supabase);
    if (!workshop_id) throw new Error("Não autenticado");

    // Se for definido como padrão, tira o padrão dos outros do mesmo tipo
    if (layout.is_padrao) {
      await supabase
        .from("print_layouts")
        .update({ is_padrao: false })
        .eq("workshop_id", workshop_id)
        .eq("tipo_cupom", layout.tipo_cupom);
    }

    const { data, error } = await supabase
      .from("print_layouts")
      .insert([{ ...layout, workshop_id }])
      .select()
      .single();

    if (error) throw error;
    return data as PrintLayout;
});

export const updatePrintLayout = createServerFn({ method: "POST" })
  .inputValidator((payload: { id: string; updates: Partial<PrintLayout> }) => payload)
  .handler(async ({ data: { id, updates }, context }) => {
    const { supabase } = context as any;
    const workshop_id = await getWorkshopId(supabase);
    if (!workshop_id) throw new Error("Não autenticado");

    if (updates.is_padrao && updates.tipo_cupom) {
      await supabase
        .from("print_layouts")
        .update({ is_padrao: false })
        .eq("workshop_id", workshop_id)
        .eq("tipo_cupom", updates.tipo_cupom);
    } else if (updates.is_padrao) {
      // Busca o tipo de cupom atual do layout para desativar os outros
      const current = await supabase.from("print_layouts").select("tipo_cupom").eq("id", id).single();
      if (current.data) {
        await supabase
          .from("print_layouts")
          .update({ is_padrao: false })
          .eq("workshop_id", workshop_id)
          .eq("tipo_cupom", current.data.tipo_cupom);
      }
    }

    const { data, error } = await supabase
      .from("print_layouts")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workshop_id", workshop_id)
      .select()
      .single();

    if (error) throw error;
    return data as PrintLayout;
});

export const deletePrintLayout = createServerFn({ method: "POST" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id, context }) => {
    const { supabase } = context as any;
    const workshop_id = await getWorkshopId(supabase);
    if (!workshop_id) throw new Error("Não autenticado");

    const { error } = await supabase
      .from("print_layouts")
      .delete()
      .eq("id", id)
      .eq("workshop_id", workshop_id);

    if (error) throw error;
    return { success: true };
});

export const getPrintLayoutPadrao = createServerFn({ method: "GET" })
  .inputValidator((tipo_cupom: string) => tipo_cupom)
  .handler(async ({ data: tipo_cupom, context }) => {
    const { supabase } = context as any;
    const workshop_id = await getWorkshopId(supabase);
    if (!workshop_id) return null;

    const { data, error } = await supabase
      .from("print_layouts")
      .select("*")
      .eq("workshop_id", workshop_id)
      .eq("tipo_cupom", tipo_cupom)
      .eq("is_padrao", true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data as PrintLayout;
});
