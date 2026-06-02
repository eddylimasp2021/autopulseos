import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Função para gerar link de pagamento no Asaas
export const generateAsaasPaymentLinkHandler = async ({ context }: { context: any }) => {
  const { supabase, userId } = context;
  if (!userId) throw new Error("Não autenticado");

  // Busca a oficina do usuário
  const { data: memberData, error: errM } = await supabase
    .from("workshop_members")
    .select("workshop_id, workshops(name, plan)")
    .eq("user_id", userId)
    .maybeSingle();

  if (errM || !memberData) {
    throw new Error("Oficina não encontrada.");
  }

  const workshopId = memberData.workshop_id;
  const workshopName = memberData.workshops?.name || "Oficina";

  // Busca configuração do SaaS (Asaas API Key)
  const { data: saasConfig, error: errCfg } = await supabaseAdmin
    .from("saas_config")
    .select("asaas_api_key")
    .eq("id", 1)
    .maybeSingle();

  if (errCfg || !saasConfig?.asaas_api_key) {
    throw new Error("Gateway de Pagamento não configurado pelo administrador.");
  }

  const apiKey = saasConfig.asaas_api_key;
  
  try {
    // 1. Criar Cliente no Asaas (garante que externalReference seja o workshopId)
    const customerPayload = {
      name: workshopName,
      externalReference: workshopId, // Importante para o nosso Webhook
      // email: ... (podemos omitir e deixar o cliente preencher no checkout do Asaas)
    };

    let customerId = "";
    const resCustomer = await fetch("https://api.asaas.com/v3/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": apiKey },
      body: JSON.stringify(customerPayload)
    });

    if (!resCustomer.ok) {
      const errTxt = await resCustomer.text();
      console.error("[Asaas Customer Error]:", errTxt);
      throw new Error("Falha ao criar cliente no Gateway.");
    }
    const customerData = await resCustomer.json();
    customerId = customerData.id;

    // 2. Criar Assinatura para o Cliente
    const today = new Date();
    today.setDate(today.getDate() + 1); // Vencimento amanhã
    const nextDueDate = today.toISOString().slice(0, 10);

    const subPayload = {
      customer: customerId,
      billingType: "UNDEFINED", // Cartão, Pix ou Boleto
      value: 350.00,
      nextDueDate: nextDueDate,
      cycle: "MONTHLY",
      description: `Assinatura Profissional - ${workshopName}`
    };

    const resSub = await fetch("https://api.asaas.com/v3/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": apiKey },
      body: JSON.stringify(subPayload)
    });

    if (!resSub.ok) {
      const errTxt = await resSub.text();
      console.error("[Asaas Sub Error]:", errTxt);
      throw new Error("Falha ao criar assinatura no Gateway.");
    }

    const subData = await resSub.json();
    // Em assinaturas com billingType UNDEFINED, o Asaas retorna uma invoiceUrl ou precisamos pegar a fatura gerada.
    // O Asaas geralmente envia um e-mail para o cliente, ou podemos mandar para o subData.invoiceUrl (ou algo similar).
    // Para subscriptions recém criadas, o Asaas pode não retornar a invoiceUrl de imediato na raiz, mas retorna em `invoiceUrl` se disponível.
    // Vamos usar a URL geral de pagamentos se invoiceUrl não estiver disponível.
    const url = subData.invoiceUrl || (subData.id ? `https://www.asaas.com/c/${subData.id}` : null);

    if (!url) {
       throw new Error("Asaas não retornou URL da fatura.");
    }

    return { url };
  } catch (error: any) {
    throw new Error(error.message || "Erro na comunicação com o Gateway.");
  }
};

export const generateAsaasPaymentLink = createServerFn({ method: "POST" }).handler(generateAsaasPaymentLinkHandler);
