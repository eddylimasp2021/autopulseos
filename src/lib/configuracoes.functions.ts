import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getWorkshop = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data: members, error: em } = await supabase
    .from("workshop_members")
    .select("workshop_id,role,workshops(id,name,slug,logo_url,plan,trial_ends_at)")
    .order("created_at", { ascending: true })
    .limit(1);
  if (em) throw new Error(em.message);
  const m = members?.[0];
  if (!m) return null;
  return { role: m.role, ...m.workshops };
});

const WorkshopInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  logo_url: z.string().trim().max(500).optional().nullable(),
});

export const updateWorkshop = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof WorkshopInput>) => WorkshopInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { id, ...rest } = data;
    const payload: any = { name: rest.name };
    if (rest.logo_url !== undefined) payload.logo_url = rest.logo_url || null;
    const { error } = await supabase.from("workshops").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getProfile = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase, userId } = context as any;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

const ProfileInput = z.object({
  full_name: z.string().trim().min(1).max(120),
  avatar_url: z.string().trim().max(500).optional().nullable(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof ProfileInput>) => ProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: data.full_name, avatar_url: data.avatar_url || null })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTeam = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const { supabase } = context as any;
  const { data: members, error } = await supabase
    .from("workshop_members")
    .select("id,role,user_id,created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const ids = Array.from(new Set((members ?? []).map((m: any) => m.user_id)));
  let profilesById: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
  if (ids.length) {
    const { data: profs } = await supabase.from("profiles").select("id,full_name,avatar_url").in("id", ids);
    for (const p of profs ?? []) profilesById[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
  }
  return (members ?? []).map((m: any) => ({ ...m, profile: profilesById[m.user_id] ?? null }));
});