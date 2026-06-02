export async function logSecurityEvent(
  supabase: any,
  userId: string | null | undefined,
  workshopId: string | null | undefined,
  eventType: string,
  severity: "info" | "warning" | "critical",
  details: Record<string, any> = {}
) {
  // Sempre logar no console do servidor para persistência em stdout/stderr
  const logMsg = `[SECURITY LOG] Type: ${eventType} | User: ${userId || "anon"} | Workshop: ${workshopId || "none"} | Severity: ${severity.toUpperCase()} | Details: ${JSON.stringify(details)}`;
  if (severity === "critical" || severity === "warning") {
    console.warn(logMsg);
  } else {
    console.log(logMsg);
  }

  // Tentar persistir no banco de dados Supabase
  try {
    let resolvedWorkshopId = workshopId;
    if (!resolvedWorkshopId && userId) {
      const { data: member } = await supabase
        .from("workshop_members")
        .select("workshop_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (member) resolvedWorkshopId = member.workshop_id;
    }

    if (resolvedWorkshopId) {
      const { error } = await supabase
        .from("security_events")
        .insert({
          user_id: userId || null,
          workshop_id: resolvedWorkshopId,
          event_type: eventType,
          severity,
          details
        });
      if (error) {
        console.error(`[SECURITY LOGGER] Falha ao gravar evento no Supabase: ${error.message}`);
      }
    } else {
      console.warn(`[SECURITY LOGGER] Evento ignorado no Supabase devido a falta de workshop_id: ${eventType}`);
    }
  } catch (e: any) {
    console.error(`[SECURITY LOGGER] Erro inesperado ao gravar log de segurança: ${e.message}`);
  }
}
