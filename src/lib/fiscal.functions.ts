import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logSecurityEvent } from "@/lib/security.logger";

// ============ SCHEMAS & TYPES ============

const FiscalConfigInput = z.object({
  id: z.string().uuid().optional().nullable(),
  cnpj: z.string().trim().optional().nullable(),
  razao_social: z.string().trim().optional().nullable(),
  nome_fantasia: z.string().trim().optional().nullable(),
  inscricao_estadual: z.string().trim().optional().nullable(),
  inscricao_municipal: z.string().trim().optional().nullable(),
  regime_tributario: z.string().trim().optional().nullable(),
  cnae: z.string().trim().optional().nullable(),
  ambiente: z.enum(["homologacao", "producao"]).default("homologacao"),
  
  certificado_base64: z.string().trim().optional().nullable(),
  certificado_senha: z.string().trim().optional().nullable(),
  certificado_nome_arquivo: z.string().trim().optional().nullable(),
  
  nfce_serie: z.number().int().min(1).default(1),
  nfce_ultimo_numero: z.number().int().min(0).default(0),
  nfce_csc_id: z.string().trim().optional().nullable(),
  nfce_csc_token: z.string().trim().optional().nullable(),
  
  nfe_serie: z.number().int().min(1).default(1),
  nfe_ultimo_numero: z.number().int().min(0).default(0),
  
  nfse_serie: z.number().int().min(1).default(1),
  nfse_ultimo_numero: z.number().int().min(0).default(0),
  
  api_provider: z.string().trim().optional().nullable(),
  api_token: z.string().trim().optional().nullable(),
});
export type FiscalConfigInputType = z.infer<typeof FiscalConfigInput>;

const XMLInput = z.object({
  tipo: z.enum(["nfe_emitida", "nfce_emitida", "nfe_importada"]),
  chave: z.string().length(44, "A chave de acesso deve conter exatamente 44 dígitos"),
  numero: z.coerce.number().int().positive(),
  serie: z.coerce.number().int().positive(),
  data_emissao: z.string(),
  valor_total: z.coerce.number().min(0),
  xml_content: z.string(),
  xml_filename: z.string(),
  destinatario_nome: z.string().optional().nullable(),
  destinatario_documento: z.string().optional().nullable(),
  status: z.enum(["autorizada", "cancelada", "importada"]).default("autorizada"),
});
export type XMLInputType = z.infer<typeof XMLInput>;

// ============ HELPER FUNCTIONS ============

export async function verifyFiscalOwnerOrAdmin(supabase: any, userId?: string) {
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
      "fiscal_unauthorized_access",
      "warning",
      { user_role: role ?? "none", attempted_action: "manage_fiscal_config" }
    );
    throw new Error("Permissão negada. Apenas administradores ou proprietários podem gerenciar as configurações fiscais.");
  }
  return workshopId;
}

// ============ HANDLERS (for testing & execution) ============

export async function getFiscalConfigHandler({ context }: { context: any }) {
  const { supabase, userId } = context;
  const workshopId = await verifyFiscalOwnerOrAdmin(supabase, userId);

  const { data, error } = await supabase
    .from("fiscal_config")
    .select("*")
    .eq("workshop_id", workshopId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  // Mascarar campos sensíveis nas respostas de API
  if (data) {
    if (data.api_token) data.api_token = "***";
    if (data.certificado_senha) data.certificado_senha = "***";
    if (data.nfce_csc_token) data.nfce_csc_token = "***";
  }
  return data;
}

export async function saveFiscalConfigHandler({ data, context }: { data: FiscalConfigInputType; context: any }) {
  const { supabase, userId } = context;
  const workshopId = await verifyFiscalOwnerOrAdmin(supabase, userId);
  
  const payload: any = {};
  const fields = [
    "cnpj", "razao_social", "nome_fantasia", "inscricao_estadual", "inscricao_municipal",
    "regime_tributario", "cnae", "ambiente", "certificado_base64", "certificado_senha",
    "certificado_nome_arquivo", "nfce_serie", "nfce_ultimo_numero", "nfce_csc_id",
    "nfce_csc_token", "nfe_serie", "nfe_ultimo_numero", "nfse_serie", "nfse_ultimo_numero",
    "api_provider", "api_token"
  ];
  
  fields.forEach(field => {
    if ((data as any)[field] !== undefined) {
      payload[field] = (data as any)[field];
    }
  });

  // Se as credenciais sensíveis vierem mascaradas como "***", nós não as atualizamos no banco de dados
  const sensitiveFields = ["api_token", "certificado_senha", "nfce_csc_token"];
  sensitiveFields.forEach(field => {
    if (payload[field] === "***") {
      delete payload[field];
    }
  });

  // Buscar config existente para auditoria
  const { data: existing } = await supabase
    .from("fiscal_config")
    .select("*")
    .eq("workshop_id", workshopId)
    .maybeSingle();

  if (data.id) {
    // Garantir que a config pertence ao mesmo workshop
    if (!existing || existing.id !== data.id) {
      throw new Error("Configuração fiscal não encontrada ou pertence a outra oficina.");
    }

    payload.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from("fiscal_config")
      .update(payload)
      .eq("id", data.id)
      .eq("workshop_id", workshopId);
    if (error) throw new Error(error.message);

    // Calcular alterações para o log
    const changes: any = {};
    const largeFields = ["certificado_base64"];

    for (const k of Object.keys(payload)) {
      if (k === "updated_at") continue;
      const val = (payload as any)[k];
      const oldVal = (existing as any)[k];
      if (val !== oldVal) {
        if (sensitiveFields.includes(k)) {
          changes[k] = {
            old: oldVal ? "***" : null,
            new: val ? "***" : null
          };
        } else if (largeFields.includes(k)) {
          changes[k] = {
            old: oldVal ? `[base64: ${oldVal.length} chars]` : null,
            new: val ? `[base64: ${val.length} chars]` : null
          };
        } else {
          changes[k] = { old: oldVal, new: val };
        }
      }
    }
    
    if (Object.keys(changes).length > 0) {
      await logSecurityEvent(
        supabase,
        userId,
        workshopId,
        "fiscal_config_changed",
        "info",
        { changes }
      );
    }
  } else {
    // Inserir garantindo o workshop_id correto da conta logada
    const { error } = await supabase
      .from("fiscal_config")
      .insert({
        ...payload,
        workshop_id: workshopId
      });
    if (error) throw new Error(error.message);

    // Saneamento para log
    const sanitizedData = { ...payload };
    if (sanitizedData.api_token) sanitizedData.api_token = "***";
    if (sanitizedData.certificado_senha) sanitizedData.certificado_senha = "***";
    if (sanitizedData.nfce_csc_token) sanitizedData.nfce_csc_token = "***";
    if (sanitizedData.certificado_base64) {
      sanitizedData.certificado_base64 = `[base64: ${sanitizedData.certificado_base64.length} chars]`;
    }

    await logSecurityEvent(
      supabase,
      userId,
      workshopId,
      "fiscal_config_created",
      "info",
      { config: sanitizedData }
    );
  }
  return { ok: true };
}

export async function saveFiscalXMLHandler({ data, context }: { data: XMLInputType; context: any }) {
  const { supabase, userId } = context;
  
  // Obter o workshop_id do usuário logado
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
  
  // Verificar chave duplicada apenas dentro da própria oficina
  const { data: existing } = await supabase
    .from("fiscal_xmls")
    .select("id")
    .eq("chave", data.chave)
    .eq("workshop_id", workshopId)
    .maybeSingle();
    
  if (existing) {
    throw new Error(`O arquivo XML com a chave de acesso ${data.chave} já está cadastrado.`);
  }
  
  const { data: row, error } = await supabase
    .from("fiscal_xmls")
    .insert({
      workshop_id: workshopId,
      tipo: data.tipo,
      chave: data.chave,
      numero: data.numero,
      serie: data.serie,
      data_emissao: data.data_emissao,
      valor_total: data.valor_total,
      xml_content: data.xml_content,
      xml_filename: data.xml_filename,
      destinatario_nome: data.destinatario_nome || null,
      destinatario_documento: data.destinatario_documento || null,
      status: data.status
    })
    .select()
    .single();
    
  if (error) throw new Error(error.message);

  await logSecurityEvent(
    supabase,
    userId,
    workshopId,
    "fiscal_xml_uploaded",
    "info",
    { xml_id: row.id, chave: data.chave, numero: data.numero, serie: data.serie }
  );

  return row;
}

export async function listFiscalXMLsHandler({ context }: { context: any }) {
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
    .from("fiscal_xmls")
    .select("*")
    .eq("workshop_id", workshopId)
    .order("data_emissao", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deleteFiscalXMLHandler({ data, context }: { data: { id: string }; context: any }) {
  const { supabase, userId } = context;
  
  const { data: member, error: errMember } = await supabase
    .from("workshop_members")
    .select("role,workshop_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
    
  if (errMember) throw new Error(errMember.message);
  const workshopId = member?.workshop_id;
  const role = member?.role;

  if (role !== "owner" && role !== "admin") {
    await logSecurityEvent(
      supabase,
      userId,
      workshopId,
      "fiscal_unauthorized_access",
      "warning",
      { user_role: role ?? "none", attempted_action: "delete_fiscal_xml", xml_id: data.id }
    );
    throw new Error("Permissão negada. Apenas administradores ou proprietários podem excluir XMLs fiscais.");
  }

  // Verificar se o XML existe e pertence à mesma oficina
  const { data: xml } = await supabase
    .from("fiscal_xmls")
    .select("chave,numero,serie")
    .eq("id", data.id)
    .eq("workshop_id", workshopId)
    .maybeSingle();

  if (!xml) {
    throw new Error("XML não encontrado ou pertence a outra oficina.");
  }

  const { error } = await supabase
    .from("fiscal_xmls")
    .delete()
    .eq("id", data.id)
    .eq("workshop_id", workshopId);
  if (error) throw new Error(error.message);

  await logSecurityEvent(
    supabase,
    userId,
    workshopId,
    "fiscal_xml_deleted",
    "warning",
    { xml_id: data.id, chave: xml.chave, numero: xml.numero, serie: xml.serie }
  );

  return { ok: true };
}

// ============ SERVER FUNCTIONS (expostos para o front-end) ============

export const getFiscalConfig = createServerFn({ method: "GET" }).handler(getFiscalConfigHandler);

export const saveFiscalConfig = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof FiscalConfigInput>) => FiscalConfigInput.parse(d))
  .handler(saveFiscalConfigHandler);

export const saveFiscalXML = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof XMLInput>) => XMLInput.parse(d))
  .handler(saveFiscalXMLHandler);

export const listFiscalXMLs = createServerFn({ method: "GET" }).handler(listFiscalXMLsHandler);

export const deleteFiscalXML = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(deleteFiscalXMLHandler);
