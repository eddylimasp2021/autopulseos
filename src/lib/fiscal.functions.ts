import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export const getFiscalConfig = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data, error } = await supabase
    .from("fiscal_config")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export const saveFiscalConfig = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof FiscalConfigInput>) => FiscalConfigInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    if (data.id) {
      // Update
      const { error } = await supabase
        .from("fiscal_config")
        .update({
          cnpj: data.cnpj,
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia,
          inscricao_estadual: data.inscricao_estadual,
          inscricao_municipal: data.inscricao_municipal,
          regime_tributario: data.regime_tributario,
          cnae: data.cnae,
          ambiente: data.ambiente,
          certificado_base64: data.certificado_base64,
          certificado_senha: data.certificado_senha,
          certificado_nome_arquivo: data.certificado_nome_arquivo,
          nfce_serie: data.nfce_serie,
          nfce_ultimo_numero: data.nfce_ultimo_numero,
          nfce_csc_id: data.nfce_csc_id,
          nfce_csc_token: data.nfce_csc_token,
          nfe_serie: data.nfe_serie,
          nfe_ultimo_numero: data.nfe_ultimo_numero,
          nfse_serie: data.nfse_serie,
          nfse_ultimo_numero: data.nfse_ultimo_numero,
          api_provider: data.api_provider,
          api_token: data.api_token,
          updated_at: new Date().toISOString()
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      // Insert
      const { error } = await supabase
        .from("fiscal_config")
        .insert({
          cnpj: data.cnpj,
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia,
          inscricao_estadual: data.inscricao_estadual,
          inscricao_municipal: data.inscricao_municipal,
          regime_tributario: data.regime_tributario,
          cnae: data.cnae,
          ambiente: data.ambiente,
          certificado_base64: data.certificado_base64,
          certificado_senha: data.certificado_senha,
          certificado_nome_arquivo: data.certificado_nome_arquivo,
          nfce_serie: data.nfce_serie,
          nfce_ultimo_numero: data.nfce_ultimo_numero,
          nfce_csc_id: data.nfce_csc_id,
          nfce_csc_token: data.nfce_csc_token,
          nfe_serie: data.nfe_serie,
          nfe_ultimo_numero: data.nfe_ultimo_numero,
          nfse_serie: data.nfse_serie,
          nfse_ultimo_numero: data.nfse_ultimo_numero,
          api_provider: data.api_provider,
          api_token: data.api_token
        });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

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

export const saveFiscalXML = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof XMLInput>) => XMLInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    // Verificar chave duplicada
    const { data: existing } = await supabase
      .from("fiscal_xmls")
      .select("id")
      .eq("chave", data.chave)
      .maybeSingle();
      
    if (existing) {
      throw new Error(`O arquivo XML com a chave de acesso ${data.chave} já está cadastrado.`);
    }
    
    const { data: row, error } = await supabase
      .from("fiscal_xmls")
      .insert({
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
    return row;
  });

export const listFiscalXMLs = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data, error } = await supabase
    .from("fiscal_xmls")
    .select("*")
    .order("data_emissao", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const deleteFiscalXML = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("fiscal_xmls")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
