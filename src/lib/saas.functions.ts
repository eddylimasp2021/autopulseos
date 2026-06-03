import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Helper para checar se o chamador possui a role 'super_admin'
async function checkSuperAdmin(context: any) {
  const { supabase, userId, claims } = context;
  if (!userId) throw new Error("Não autenticado");

  // Bypass de segurança para o proprietário/criador da plataforma
  if (claims?.email === "eddylimainformatica@gmail.com") {
    return; // Acesso concedido
  }

  const { data: roleData, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();

  if (error || !roleData) {
    throw new Error("Acesso negado. Apenas super administradores.");
  }
}

export const listWorkshopsAdminHandler = async ({ context }: { context: any }) => {
  await checkSuperAdmin(context);

  // Busca todas as oficinas
  const { data: workshops, error: errW } = await supabaseAdmin
    .from("workshops")
    .select("*")
    .order("created_at", { ascending: false });

  if (errW) throw new Error(errW.message);

  // Busca todos os membros de oficinas para localizar os proprietários
  const { data: members, error: errM } = await supabaseAdmin
    .from("workshop_members")
    .select("workshop_id, user_id, role");

  if (errM) throw new Error(errM.message);

  // Busca os perfis públicos
  const { data: profiles, error: errP } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name");

  if (errP) throw new Error(errP.message);

  // Busca todos os usuários de autenticação para expor os emails
  let userEmailMap: Record<string, string> = {};
  try {
    const { data: { users }, error: errUsers } = await supabaseAdmin.auth.admin.listUsers();
    if (!errUsers && users) {
      for (const u of users) {
        if (u.email) userEmailMap[u.id] = u.email;
      }
    }
  } catch (e: any) {
    console.error(`[SaaS Function] Erro ao listar e-mails de usuários: ${e.message}`);
  }

  const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]));

  // Monta as oficinas com as informações dos donos
  const results = workshops.map(w => {
    const ownerMember = members?.find(m => m.workshop_id === w.id && m.role === "owner");
    const ownerUserId = ownerMember?.user_id;
    const ownerName = ownerUserId ? (profileMap.get(ownerUserId) || "Sem Nome") : "Sem Dono";
    const ownerEmail = ownerUserId ? (userEmailMap[ownerUserId] || "Sem E-mail") : "Sem E-mail";

    return {
      id: w.id,
      name: w.name,
      slug: w.slug,
      plan: w.plan,
      trial_ends_at: w.trial_ends_at,
      created_at: w.created_at,
      updated_at: w.updated_at,
      cnpj: (w as any).cnpj ?? null,
      support_enabled: (w as any).support_enabled ?? false,
      owner_name: ownerName,
      owner_email: ownerEmail
    };
  });

  return results;
};

const UpdatePlanInput = z.object({
  workshop_id: z.string().uuid(),
  plan: z.enum(["trial", "basico", "profissional", "premium"]),
  trial_ends_at: z.string().optional().nullable()
});
export type UpdatePlanInputType = z.infer<typeof UpdatePlanInput>;

export const updateWorkshopPlanAdminHandler = async ({ data, context }: { data: UpdatePlanInputType; context: any }) => {
  await checkSuperAdmin(context);

  const payload: any = {
    plan: data.plan,
    updated_at: new Date().toISOString()
  };

  if (data.plan === "trial") {
    payload.trial_ends_at = data.trial_ends_at || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  } else {
    payload.trial_ends_at = null;
  }

  const { error } = await supabaseAdmin
    .from("workshops")
    .update(payload)
    .eq("id", data.workshop_id);

  if (error) throw new Error(error.message);

  return { ok: true };
};

// ============ SERVER FUNCTIONS (expostos para o front-end) ============

export const listWorkshopsAdmin = createServerFn({ method: "GET" }).handler(listWorkshopsAdminHandler);

export const updateWorkshopPlanAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: UpdatePlanInputType) => UpdatePlanInput.parse(d))
  .handler(updateWorkshopPlanAdminHandler);

export const generateSupportLink = createServerFn({ method: "POST" })
  .inputValidator((d: { workshop_id: string }) => z.object({ workshop_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await checkSuperAdmin(context);

    // Verify if workshop has support_enabled
    const { data: workshop, error: errW } = await supabaseAdmin
      .from("workshops")
      .select("support_enabled")
      .eq("id", data.workshop_id)
      .single();

    if (errW || !workshop) throw new Error("Oficina não encontrada.");
    if (!workshop.support_enabled) throw new Error("Acesso de suporte não habilitado para esta oficina.");

    // Get the owner
    const { data: member, error: errM } = await supabaseAdmin
      .from("workshop_members")
      .select("user_id")
      .eq("workshop_id", data.workshop_id)
      .eq("role", "owner")
      .single();

    if (errM || !member) throw new Error("Proprietário da oficina não encontrado.");

    // Get owner email
    const { data: { user }, error: errU } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
    if (errU || !user || !user.email) throw new Error("E-mail do proprietário não encontrado.");

    // Generate magic link
    const { data: linkData, error: errLink } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });

    if (errLink) throw new Error("Falha ao gerar link de acesso: " + errLink.message);

    return { action_link: linkData.properties.action_link };
  });

export const getSaasConfigAdminHandler = async ({ context }: { context: any }) => {
  await checkSuperAdmin(context);

  const { data, error } = await supabaseAdmin
    .from("saas_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || { asaas_api_key: "", asaas_webhook_secret: "" };
};

const UpdateSaasConfigInput = z.object({
  asaas_api_key: z.string().optional().nullable(),
  asaas_webhook_secret: z.string().optional().nullable()
});

export const updateSaasConfigAdminHandler = async ({ data, context }: { data: z.infer<typeof UpdateSaasConfigInput>; context: any }) => {
  await checkSuperAdmin(context);

  const payload = {
    asaas_api_key: data.asaas_api_key,
    asaas_webhook_secret: data.asaas_webhook_secret,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseAdmin
    .from("saas_config")
    .upsert({ id: 1, ...payload });

  if (error) throw new Error(error.message);
  return { ok: true };
};

export const getSaasConfigAdmin = createServerFn({ method: "GET" }).handler(getSaasConfigAdminHandler);
export const updateSaasConfigAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof UpdateSaasConfigInput>) => UpdateSaasConfigInput.parse(d))
  .handler(updateSaasConfigAdminHandler);
 
// --- CONTRATOS SAAS ---

export const listContratosAdmin = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  await checkSuperAdmin(context);
  
  const { data, error } = await supabaseAdmin
    .from("saas_contratos")
    .select("*, workshops(name, cnpj)")
    .order("created_at", { ascending: false });
    
  if (error) throw new Error(error.message);
  return data ?? [];
});

const CreateContratoInput = z.object({
  workshop_id: z.string().uuid(),
  conteudo_html: z.string().min(1)
});

export const createContratoAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: any) => CreateContratoInput.parse(d))
  .handler(async ({ data, context }) => {
    await checkSuperAdmin(context);
    
    const { data: result, error } = await supabaseAdmin.from("saas_contratos").insert({
      workshop_id: data.workshop_id,
      status: "gerado",
      conteudo_html: data.conteudo_html,
      data_geracao: new Date().toISOString()
    }).select().single();
    
    if (error) throw new Error(error.message);
    return result;
  });

const UpdateContratoInput = z.object({
  id: z.string().uuid(),
  conteudo_html: z.string().min(1)
});

export const updateContratoAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: any) => UpdateContratoInput.parse(d))
  .handler(async ({ data, context }) => {
    await checkSuperAdmin(context);
    
    const { data: result, error } = await supabaseAdmin.from("saas_contratos").update({
      conteudo_html: data.conteudo_html
    }).eq("id", data.id).select().single();
    
    if (error) throw new Error(error.message);
    return result;
  });

const AssinarContratoInput = z.object({
  id: z.string().uuid(),
  assinatura_imagem: z.string().min(1)
});

export const assinarContratoAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: any) => AssinarContratoInput.parse(d))
  .handler(async ({ data, context }) => {
    await checkSuperAdmin(context);
    
    const { data: result, error } = await supabaseAdmin.from("saas_contratos").update({
      status: "assinado",
      assinatura_imagem: data.assinatura_imagem,
      data_assinatura: new Date().toISOString()
    }).eq("id", data.id).select().single();
    
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteContratoAdmin = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id, context }) => {
    await checkSuperAdmin(context);
    
    const { error } = await supabaseAdmin.from("saas_contratos").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
