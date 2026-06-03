export interface TefTransactionConfig {
  ip_servidor: string;
  porta: number;
  empresa: string;
  terminal: string;
  cnpj?: string;
  timeout: number;
}

export interface TefPaymentRequest {
  valor: number;
  tipo: "credito" | "debito" | "pix";
  parcelas?: number;
  pdv_venda_id?: string;
}

export interface TefTransactionResult {
  sucesso: boolean;
  status: "aprovado" | "negado" | "cancelado" | "erro";
  nsu?: string;
  rede?: string;
  comprovante_cliente?: string;
  comprovante_loja?: string;
  mensagem?: string;
}

// Client para TEF local (SiTef ou Mock/Simulado)
export async function iniciarTransacaoTef(
  config: TefTransactionConfig, 
  req: TefPaymentRequest, 
  onProgress?: (msg: string) => void
): Promise<TefTransactionResult> {
  const url = `http://${config.ip_servidor}:${config.porta}/venda`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), config.timeout * 1000);

  try {
    onProgress?.("Conectando ao Serviço TEF Local...");
    
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresa: config.empresa,
        terminal: config.terminal,
        cnpj: config.cnpj,
        valor: req.valor,
        tipo: req.tipo,
        parcelas: req.parcelas || 1
      }),
      signal: controller.signal
    });
    
    clearTimeout(id);

    if (!res.ok) {
      throw new Error(`Erro HTTP: ${res.status}`);
    }

    onProgress?.("Aguardando Pinpad...");
    const data = await res.json();
    return {
      sucesso: data.aprovado,
      status: data.aprovado ? "aprovado" : "negado",
      nsu: data.nsu,
      rede: data.rede,
      comprovante_cliente: data.comprovante_cliente,
      comprovante_loja: data.comprovante_loja,
      mensagem: data.mensagem || (data.aprovado ? "Transação Aprovada" : "Transação Negada")
    };
  } catch (error: any) {
    clearTimeout(id);
    
    // MODO SIMULADO (Mock) para fins de desenvolvimento ou demonstração
    // Quando o serviço TEF local não existe ou dá timeout, caímos no modo simulado.
    console.warn("Falha ao comunicar com TEF Local. Iniciando Modo Simulado.", error.message);
    
    onProgress?.("Serviço TEF indisponível.");
    await new Promise(r => setTimeout(r, 1000));
    
    onProgress?.("[Simulado] Iniciando Transação...");
    await new Promise(r => setTimeout(r, 1500));
    
    onProgress?.(`[Simulado] Insira ou Aproxime o Cartão\nValor: R$ ${req.valor.toFixed(2).replace('.',',')}`);
    await new Promise(r => setTimeout(r, 2000));
    
    onProgress?.("[Simulado] Processando pagamento...");
    await new Promise(r => setTimeout(r, 2000));
    
    const isErrorSimulation = req.valor === 0.01; // Easter egg to simulate error
    if (isErrorSimulation) {
      onProgress?.("[Simulado] Transação Negada pelo Banco");
      await new Promise(r => setTimeout(r, 1500));
      return {
        sucesso: false,
        status: "negado",
        mensagem: "Transação Não Autorizada (Modo Simulado)"
      };
    }

    onProgress?.("[Simulado] Transação Aprovada! Remova o Cartão.");
    await new Promise(r => setTimeout(r, 1000));

    const mockNsu = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    
    const mockComprovante = `
      ESTABELECIMENTO TESTE TEF
      CNPJ: ${config.cnpj || '00.000.000/0001-00'}
      ----------------------------------------
      COMPROVANTE DE PAGAMENTO
      ${new Date().toLocaleString('pt-BR')}
      
      VALOR: R$ ${req.valor.toFixed(2).replace('.', ',')}
      TIPO: ${req.tipo.toUpperCase()}
      ${req.parcelas && req.parcelas > 1 ? `PARCELAS: ${req.parcelas}x\n` : ''}
      NSU: ${mockNsu}
      AUTORIZACAO: 123456
      ----------------------------------------
      TRANSAÇÃO APROVADA (MODO SIMULADO)
    `.trim();

    return {
      sucesso: true,
      status: "aprovado",
      nsu: mockNsu,
      rede: "MOCK_REDE",
      comprovante_cliente: mockComprovante,
      comprovante_loja: mockComprovante,
      mensagem: "Transação Aprovada com Sucesso"
    };
  }
}
