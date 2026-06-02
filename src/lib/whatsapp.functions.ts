import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logSecurityEvent } from "@/lib/security.logger";

// ============ SCHEMAS & TYPES ============

const ConfigInput = z.object({
  ativo: z.boolean().optional(),
  instance_url: z.string().trim().max(255).optional().nullable(),
  token: z.string().trim().max(500).optional().nullable(),
  template_os_concluida: z.string().trim().max(1000).optional().nullable(),
  template_os_entregue: z.string().trim().max(1000).optional().nullable(),
  template_lembrete_oleo: z.string().trim().max(1000).optional().nullable(),
  template_cobranca: z.string().trim().max(1000).optional().nullable(),

  callboot_ativo: z.boolean().optional(),
  callboot_instance_url: z.string().trim().max(255).optional().nullable(),
  callboot_token: z.string().trim().max(500).optional().nullable(),
  callboot_template_os_concluida: z.string().trim().max(1000).optional().nullable(),
  callboot_template_os_entregue: z.string().trim().max(1000).optional().nullable(),
  callboot_template_lembrete_oleo: z.string().trim().max(1000).optional().nullable(),
  callboot_template_cobranca: z.string().trim().max(1000).optional().nullable(),
});
export type ConfigInputType = z.infer<typeof ConfigInput>;

const EnqueueInput = z.object({
  telefone: z.string(),
  mensagem: z.string(),
  evento: z.string().optional(),
  ref_tipo: z.string().optional(),
  ref_id: z.string().uuid().optional(),
});
export type EnqueueInputType = z.infer<typeof EnqueueInput>;

// ============ HELPER FUNCTIONS ============

export async function verifyIsOwnerOrAdmin(supabase: any, userId?: string) {
  if (!userId) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("workshop_members")
    .select("role,workshop_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  
  const role = data?.role;
  const workshopId = data?.workshop_id;

  if (role !== "owner" && role !== "admin") {
    await logSecurityEvent(
      supabase,
      userId,
      workshopId,
      "whatsapp_unauthorized_access",
      "warning",
      { user_role: role ?? "none", attempted_action: "manage_whatsapp_config" }
    );
    throw new Error("Permissão negada. Apenas administradores ou proprietários podem gerenciar o WhatsApp.");
  }
  return workshopId;
}

// ============ HANDLERS (for testing & execution) ============

export async function listMensagensHandler({ context }: { context: any }) {
  const { supabase, userId } = context;

  const { data: member, error: errMember } = await supabase
    .from("workshop_members")
    .select("workshop_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (errMember) throw new Error(errMember.message);
  const workshopId = member?.workshop_id;

  const { data, error } = await supabase
    .from("whatsapp_mensagens")
    .select("id,telefone,mensagem,evento,status,enviado_em,erro,tentativas,created_at")
    .eq("workshop_id", workshopId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getConfigHandler({ context }: { context: any }) {
  const { supabase, userId } = context;
  const workshopId = await verifyIsOwnerOrAdmin(supabase, userId);

  const { data, error } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("workshop_id", workshopId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  // Nunca retornar o token real do WhatsApp/Callboot nas respostas da API
  if (data) {
    if (data.token) data.token = "***";
    if (data.callboot_token) data.callboot_token = "***";
  }
  return data;
}

export async function upsertConfigHandler({ data, context }: { data: ConfigInputType; context: any }) {
  const { supabase, userId } = context;
  
  // Verificar permissão e obter workshop_id
  const workshopId = await verifyIsOwnerOrAdmin(supabase, userId);

  // Buscar config existente para logar modificações
  const { data: existing } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("workshop_id", workshopId)
    .maybeSingle();

  // Se o token vier como o valor mascarado "***", não atualizamos/sobrescrevemos o valor no banco
  const payload = { ...data };
  if (payload.token === "***") {
    delete payload.token;
  }
  if (payload.callboot_token === "***") {
    delete payload.callboot_token;
  }

  if (existing) {
    const { error } = await supabase
      .from("whatsapp_config")
      .update(payload)
      .eq("workshop_id", workshopId);
    if (error) throw new Error(error.message);

    // Calcular alterações para o log
    const changes: any = {};
    const sensitiveKeys = ["token", "callboot_token"];
    for (const k of Object.keys(payload)) {
      const val = (payload as any)[k];
      const oldVal = (existing as any)[k];
      if (val !== oldVal) {
        changes[k] = {
          old: sensitiveKeys.includes(k) ? (oldVal ? "***" : null) : oldVal,
          new: sensitiveKeys.includes(k) ? (val ? "***" : null) : val
        };
      }
    }
    
    if (Object.keys(changes).length > 0) {
      await logSecurityEvent(
        supabase,
        userId,
        workshopId,
        "whatsapp_config_changed",
        "info",
        { changes }
      );
    }
  } else {
    const { error } = await supabase
      .from("whatsapp_config")
      .insert({
        ...payload,
        workshop_id: workshopId
      });
    if (error) throw new Error(error.message);

    // Saneamento para log
    const sanitizedData = { ...payload };
    if (sanitizedData.token) sanitizedData.token = "***";
    if (sanitizedData.callboot_token) sanitizedData.callboot_token = "***";

    await logSecurityEvent(
      supabase,
      userId,
      workshopId,
      "whatsapp_config_created",
      "info",
      { config: sanitizedData }
    );
  }
  return { ok: true };
}

export async function enqueueWhatsappMessageHandler({ data, context }: { data: EnqueueInputType; context: any }) {
  const { supabase, userId } = context;
  
  const { data: member, error: errMember } = await supabase
    .from("workshop_members")
    .select("workshop_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
    
  if (errMember) throw new Error(errMember.message);
  const workshopId = member?.workshop_id;
  if (!workshopId) throw new Error("Oficina não encontrada.");

  const { error } = await supabase.from("whatsapp_mensagens").insert({
    workshop_id: workshopId,
    telefone: data.telefone.replace(/\D/g, ""), // Limpar caracteres não numéricos
    mensagem: data.mensagem,
    evento: data.evento || "manual",
    ref_tipo: data.ref_tipo,
    ref_id: data.ref_id,
    status: "pendente"
  });

  if (error) throw new Error(error.message);
  return { ok: true };
}

// ============ SERVER FUNCTIONS (expostos para o front-end) ============

export const listMensagens = createServerFn({ method: "GET" }).handler(listMensagensHandler);

export const getConfig = createServerFn({ method: "GET" }).handler(getConfigHandler);

export const upsertConfig = createServerFn({ method: "POST" })
  .inputValidator((d: ConfigInputType) => ConfigInput.parse(d))
  .handler(upsertConfigHandler);

export const enqueueWhatsappMessage = createServerFn({ method: "POST" })
  .inputValidator((d: EnqueueInputType) => EnqueueInput.parse(d))
  .handler(enqueueWhatsappMessageHandler);