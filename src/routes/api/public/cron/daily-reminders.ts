import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

export const Route = createFileRoute("/api/public/cron/daily-reminders")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
    // 1. Validação de segurança idêntica ao dispatch
    const url = new URL(request.url);
    const cronSecret = process.env.CRON_SECRET || import.meta.env.VITE_CRON_SECRET;
    
    const authHeader = request.headers.get("Authorization");
    const passedSecret = url.searchParams.get("secret") || (authHeader ? authHeader.replace("Bearer ", "") : null);

    if (cronSecret && passedSecret !== cronSecret) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const results = { lembretes_oleo_criados: 0, erros: [] as string[] };
      const hoje = new Date();
      // Data daqui a 7 dias exatos (considerando apenas a data, sem hora)
      const dataDaquiA7Dias = new Date(hoje);
      dataDaquiA7Dias.setDate(hoje.getDate() + 7);
      const dataIsoString = dataDaquiA7Dias.toISOString().split("T")[0]; // "YYYY-MM-DD"

      // 2. Buscar trocas de óleo com vencimento em exatos 7 dias e status pendente
      const { data: trocasOleo, error: fetchError } = await supabaseAdmin
        .from("troca_oleo")
        .select(`
          id, 
          workshop_id, 
          veiculo_id, 
          cliente_id, 
          proxima_data,
          veiculos ( placa, modelo ),
          clientes ( nome, telefone )
        `)
        .eq("status", "pendente")
        .eq("proxima_data", dataIsoString);

      if (fetchError) throw fetchError;

      if (!trocasOleo || trocasOleo.length === 0) {
        return json({ message: "Nenhum lembrete para hoje", results });
      }

      // Agrupar por workshop para pegar o template
      const workshopsIds = [...new Set(trocasOleo.map(t => t.workshop_id))];
      const { data: configs } = await supabaseAdmin
        .from("whatsapp_config")
        .select("workshop_id, template_lembrete_oleo")
        .in("workshop_id", workshopsIds);
        
      const configMap = new Map(configs?.map(c => [c.workshop_id, c]));

      // 3. Criar mensagens na fila
      for (const troca of trocasOleo) {
        const config = configMap.get(troca.workshop_id);
        const telefone = troca.clientes?.telefone;
        
        if (!telefone) continue; // Sem telefone, não temos como mandar msg
        
        // Pega o template configurado ou usa um padrão
        const template = config?.template_lembrete_oleo || 
          "Olá {cliente_nome}! Notamos que a troca de óleo do seu veículo {veiculo_modelo} (Placa: {veiculo_placa}) está próxima ({proxima_data}). Que tal agendar a próxima revisão conosco?";
          
        const clienteNome = troca.clientes?.nome?.split(" ")[0] || "Cliente";
        const veiculoModelo = troca.veiculos?.modelo || "veículo";
        const veiculoPlaca = troca.veiculos?.placa || "N/A";
        // Formatar data para BR
        const dataFormatada = dataDaquiA7Dias.toLocaleDateString('pt-BR');

        // Substituir variáveis no template
        const mensagemFinal = template
          .replace(/{cliente_nome}/g, clienteNome)
          .replace(/{veiculo_modelo}/g, veiculoModelo)
          .replace(/{veiculo_placa}/g, veiculoPlaca)
          .replace(/{proxima_data}/g, dataFormatada);

        // Inserir na fila de envio
        const { error: insertError } = await supabaseAdmin
          .from("whatsapp_mensagens")
          .insert({
            workshop_id: troca.workshop_id,
            telefone: telefone.replace(/\D/g, ""), // Somente números
            mensagem: mensagemFinal,
            evento: "lembrete_oleo",
            ref_tipo: "troca_oleo",
            ref_id: troca.id,
            status: "pendente"
          });

        if (insertError) {
          results.erros.push(`Falha ao enfileirar lembrete OS ${troca.id}: ${insertError.message}`);
        } else {
          // Atualiza status da troca de óleo para 'notificado' para não mandar novamente
          await supabaseAdmin
            .from("troca_oleo")
            .update({ status: "notificado" })
            .eq("id", troca.id);
            
          results.lembretes_oleo_criados++;
        }
      }

      return json({ message: "Processamento de lembretes concluído", results });
    } catch (error: any) {
      return json({ error: error.message }, { status: 500 });
    }
      },
    },
  },
});
