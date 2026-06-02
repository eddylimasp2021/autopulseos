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
