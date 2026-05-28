import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Função para disparar a API da UAZAPI
async function sendWhatsappMessage(instanceUrl: string, token: string, number: string, text: string) {
  // O endpoint exato pode variar, mas assumindo /message/sendText/{instance} ou similar genérico
  // Baseando no padrao comum de Evolution API ou Chat API
  // Caso o usuário precise mudar a assinatura, é só ajustar esta requisição.
  
  // Garantir que a URL base termine sem barra e apontar para sendText ou o nome do endpoint padrao
  const baseUrl = instanceUrl.replace(/\/$/, "");
  // Como nao temos a documentação final da UAZAPI, assumimos a rota de envio de texto padrao (ex: Evolution API)
  const endpoint = `${baseUrl}/message/sendText/AutoPulse`; // ou similar

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": token,
    },
    body: JSON.stringify({
      number,
      options: {
        delay: 1200,
        presence: "composing"
      },
      textMessage: {
        text
      }
    })
  });

  if (!response.ok) {
    const textResp = await response.text();
    throw new Error(`Erro na UAZAPI (${response.status}): ${textResp}`);
  }

  return await response.json();
}

export const APIRoute = createAPIFileRoute("/api/public/cron/whatsapp-dispatch")({
  GET: async ({ request }) => {
    // 1. Validação simples de segurança (Cron Secret)
    const url = new URL(request.url);
    const cronSecret = process.env.CRON_SECRET || import.meta.env.VITE_CRON_SECRET;
    
    // Suportamos autenticação via header Authorization: Bearer <secret> ou query string ?secret=...
    const authHeader = request.headers.get("Authorization");
    const passedSecret = url.searchParams.get("secret") || (authHeader ? authHeader.replace("Bearer ", "") : null);

    if (cronSecret && passedSecret !== cronSecret) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      // 2. Buscar mensagens pendentes no banco (bypassing RLS)
      const { data: mensagens, error: fetchError } = await supabaseAdmin
        .from("whatsapp_mensagens")
        .select("*")
        .eq("status", "pendente")
        .order("created_at", { ascending: true })
        .limit(50); // Processar em lotes de 50 para evitar timeout

      if (fetchError) throw fetchError;
      
      if (!mensagens || mensagens.length === 0) {
        return json({ message: "Nenhuma mensagem pendente" });
      }

      const results = { enviados: 0, falhas: 0, erros: [] as string[] };

      // 3. Agrupar por workshop_id para otimizar busca de config
      const workshopsIds = [...new Set(mensagens.map(m => m.workshop_id))];
      
      const { data: configs } = await supabaseAdmin
        .from("whatsapp_config")
        .select("*")
        .in("workshop_id", workshopsIds);

      const configMap = new Map(configs?.map(c => [c.workshop_id, c]));

      // 4. Processar e enviar as mensagens
      for (const msg of mensagens) {
        const config = configMap.get(msg.workshop_id);

        if (!config || !config.ativo || !config.instance_url || !config.token) {
          // Marca como falha se oficina não configurou WhatsApp
          await supabaseAdmin
            .from("whatsapp_mensagens")
            .update({ status: "falhou", erro: "WhatsApp não configurado ou inativo para a oficina." })
            .eq("id", msg.id);
          results.falhas++;
          continue;
        }

        try {
          // Tentar enviar a mensagem pela UAZAPI
          await sendWhatsappMessage(
            config.instance_url,
            config.token,
            msg.telefone,
            msg.mensagem
          );

          // Atualizar status no banco
          await supabaseAdmin
            .from("whatsapp_mensagens")
            .update({ 
              status: "enviado", 
              enviado_em: new Date().toISOString(),
              erro: null
            })
            .eq("id", msg.id);
          
          results.enviados++;
        } catch (error: any) {
          // Atualiza status como falha e incrementa tentativas
          await supabaseAdmin
            .from("whatsapp_mensagens")
            .update({ 
              status: msg.tentativas >= 3 ? "falhou" : "pendente", 
              erro: error.message,
              tentativas: msg.tentativas + 1 
            })
            .eq("id", msg.id);
            
          results.falhas++;
          results.erros.push(`[Msg ${msg.id}]: ${error.message}`);
        }
      }

      return json({ message: "Processamento concluído", results });
    } catch (error: any) {
      return json({ error: error.message }, { status: 500 });
    }
  },
});
