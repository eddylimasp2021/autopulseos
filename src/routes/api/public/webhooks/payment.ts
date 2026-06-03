import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

export const Route = createFileRoute("/api/public/webhooks/payment")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // 1. Validar autenticidade do Webhook
          const { data: saasConfig, error: cfgError } = await supabaseAdmin
            .from("saas_config")
            .select("asaas_webhook_secret")
            .eq("id", 1)
            .maybeSingle();

          if (cfgError) {
            console.error("[Webhook Payment] Erro ao buscar saas_config:", cfgError);
            return json({ error: "Configuração não encontrada" }, { status: 500 });
          }

          const webhookSecret = saasConfig?.asaas_webhook_secret;
          if (webhookSecret) {
            const authHeader = request.headers.get("asaas-access-token");
            if (authHeader !== webhookSecret) {
              return json({ error: "Token de acesso inválido ou ausente" }, { status: 401 });
            }
          }

          // 2. Extrair payload
          const payload = await request.json();
          const { event, payment } = payload;

          // Processamos apenas eventos de pagamento confirmado
          if (event !== "PAYMENT_RECEIVED" && event !== "PAYMENT_CONFIRMED") {
            return json({ message: "Evento ignorado", event });
          }

          // 3. Obter o workshop_id (idealmente passado via externalReference no Asaas)
          // Se não houver externalReference, podemos buscar na base através do customer do Asaas
          // Para esta versão inicial, assumimos que o externalReference contém o workshop_id
          const workshopId = payment?.externalReference;
          
          if (!workshopId) {
            console.warn("[Webhook Payment] Pagamento recebido sem externalReference (workshop_id). Ignorando.", payment?.id);
            return json({ error: "Workshop ID não informado no externalReference" }, { status: 400 });
          }

          // 4. Atualizar o plano da oficina para profissional (ativo)
          const { error: updateError } = await supabaseAdmin
            .from("workshops")
            .update({
              plan: "profissional",
              trial_ends_at: null,
              updated_at: new Date().toISOString()
            } as any)
            .eq("id", workshopId);

          if (updateError) {
            console.error("[Webhook Payment] Erro ao atualizar plano da oficina:", updateError);
            return json({ error: "Falha ao atualizar plano" }, { status: 500 });
          }

          console.log(`[Webhook Payment] Plano da oficina ${workshopId} ativado com sucesso! Pagamento: ${payment?.id}`);
          return json({ success: true, message: "Plano ativado com sucesso" });

        } catch (error: any) {
          console.error("[Webhook Payment] Erro genérico:", error);
          return json({ error: "Internal Server Error" }, { status: 500 });
        }
      },
    },
  },
});
