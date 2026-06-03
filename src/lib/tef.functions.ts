import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TefConfigInput = z.object({
  ativo: z.boolean(),
  ip_servidor: z.string().trim().max(100),
  porta: z.number().int().min(1).max(65535),
  empresa: z.string().trim().max(50),
  terminal: z.string().trim().max(50),
  cnpj: z.string().trim().max(20).optional().nullable(),
  timeout: z.number().int().min(5).max(120),
});

export type TefConfigInputType = z.infer<typeof TefConfigInput>;

export const getTefConfig = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase, userId } = context as any;

  const { data: member, error: errMember } = await supabase
    .from("workshop_members")
    .select("workshop_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (errMember) throw new Error(errMember.message);
  const workshopId = member?.workshop_id;
  if (!workshopId) return null;

  const { data, error } = await supabase
    .from("tef_config")
    .select("*")
    .eq("workshop_id", workshopId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
});

export const upsertTefConfig = createServerFn({ method: "POST" })
  .inputValidator((d: TefConfigInputType) => TefConfigInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const { data: member, error: errMember } = await supabase
      .from("workshop_members")
      .select("workshop_id, role")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (errMember) throw new Error(errMember.message);
    const workshopId = member?.workshop_id;

    // TODO: Consider superadmin role check if necessary
    if (member?.role !== "owner" && member?.role !== "admin") {
      const { data: superAdmin } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
      if (!superAdmin) throw new Error("Acesso negado. Apenas proprietários podem gerenciar o TEF.");
    }

    const { data: existing } = await supabase
      .from("tef_config")
      .select("workshop_id")
      .eq("workshop_id", workshopId)
      .maybeSingle();

    const payload = {
      ...data,
      workshop_id: workshopId,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      const { error } = await supabase.from("tef_config").update(payload).eq("workshop_id", workshopId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("tef_config").insert(payload);
      if (error) throw new Error(error.message);
    }

    return { success: true };
  });

export const createTefTransaction = createServerFn({ method: "POST" })
  .inputValidator((d: { valor: number, tipo: string, pdv_venda_id?: string }) => z.object({
    valor: z.number().positive(),
    tipo: z.string(),
    pdv_venda_id: z.string().uuid().optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const { data: member } = await supabase
      .from("workshop_members")
      .select("workshop_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const workshopId = member?.workshop_id;

    const { data: tx, error } = await supabase
      .from("tef_transactions")
      .insert({
        workshop_id: workshopId,
        valor: data.valor,
        tipo: data.tipo,
        pdv_venda_id: data.pdv_venda_id || null,
        status: "pendente"
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return tx.id;
  });

export const updateTefTransaction = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string, status: string, nsu?: string, rede?: string, comprovante_cliente?: string, comprovante_loja?: string }) => z.object({
    id: z.string().uuid(),
    status: z.string(),
    nsu: z.string().optional(),
    rede: z.string().optional(),
    comprovante_cliente: z.string().optional(),
    comprovante_loja: z.string().optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { id, ...updates } = data;
    const { error } = await supabase.from("tef_transactions").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
