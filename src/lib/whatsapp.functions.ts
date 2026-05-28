import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listMensagens = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data, error } = await supabase
    .from("whatsapp_mensagens")
    .select("id,telefone,mensagem,evento,status,enviado_em,erro,tentativas,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getConfig = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data, error } = await supabase
    .from("whatsapp_config")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

const ConfigInput = z.object({
  ativo: z.boolean().optional(),
  instance_url: z.string().trim().max(255).optional().nullable(),
  token: z.string().trim().max(500).optional().nullable(),
  template_os_concluida: z.string().trim().max(1000).optional().nullable(),
  template_os_entregue: z.string().trim().max(1000).optional().nullable(),
  template_lembrete_oleo: z.string().trim().max(1000).optional().nullable(),
  template_cobranca: z.string().trim().max(1000).optional().nullable(),
});
export type ConfigInputType = z.infer<typeof ConfigInput>;

export const upsertConfig = createServerFn({ method: "POST" })
  .inputValidator((d: ConfigInputType) => ConfigInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    // Verifica se já existe (1 por workshop via RLS)
    const { data: existing } = await supabase.from("whatsapp_config").select("workshop_id").maybeSingle();
    if (existing) {
      const { error } = await supabase.from("whatsapp_config").update(data).eq("workshop_id", existing.workshop_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("whatsapp_config").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const EnqueueInput = z.object({
  telefone: z.string(),
  mensagem: z.string(),
  evento: z.string().optional(),
  ref_tipo: z.string().optional(),
  ref_id: z.string().uuid().optional(),
});
export type EnqueueInputType = z.infer<typeof EnqueueInput>;

export const enqueueWhatsappMessage = createServerFn({ method: "POST" })
  .inputValidator((d: EnqueueInputType) => EnqueueInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    // O workshop_id será preenchido via trigger se não fornecido e se o user for membro de apenas 1
    // A RLS "members insert wamsg" cuidará da validação
    const { error } = await supabase.from("whatsapp_mensagens").insert({
      telefone: data.telefone.replace(/\D/g, ""), // Limpar caracteres não numéricos
      mensagem: data.mensagem,
      evento: data.evento || "manual",
      ref_tipo: data.ref_tipo,
      ref_id: data.ref_id,
      status: "pendente"
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });