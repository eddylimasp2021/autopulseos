import type { PrintLayout } from "./printLayouts.functions";
import type { CupomData } from "./print";

export interface PrintWorkshopData {
  workshopName: string;
  workshopLogo?: string;
  endereco?: string;
  telefone?: string;
}

export function generateReceiptHtml(
  layout: Partial<PrintLayout>, 
  workshopData: PrintWorkshopData, 
  data: CupomData | 'mock'
): string {
  const width = layout.largura_papel === "80mm" ? "80mm" : "58mm";
  
  let baseFontSize = 12;
  if (layout.tamanho_fonte === "pequena") baseFontSize = 10;
  if (layout.tamanho_fonte === "grande") baseFontSize = 14;

  let paddingY = 2; // px
  if (layout.espacamento === "compacto") paddingY = 0;
  if (layout.espacamento === "largo") paddingY = 6;

  const logoStyle = "max-width: 80%; max-height: 80px; margin: 0 auto 10px; display: block; filter: grayscale(100%);";
  const getDashedLine = () => `<div style="border-bottom: 1px dashed #000; margin: ${8 + paddingY}px 0;"></div>`;
  const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Cupom</title>
      <style>
        body {
          font-family: monospace;
          width: ${width};
          margin: 0 auto;
          padding: 10px;
          color: #000;
          font-size: ${baseFontSize}px;
          line-height: ${layout.espacamento === 'compacto' ? '1.1' : layout.espacamento === 'largo' ? '1.6' : '1.3'};
          box-sizing: border-box;
        }
        h2 { text-align: center; font-size: ${baseFontSize + 4}px; margin: 0 0 ${8 + paddingY}px; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: ${paddingY}px 0; }
        th { border-bottom: 1px dashed #000; }
        
        @media print {
          @page { margin: 0; }
          body { margin: 0; padding: 5px; width: 100%; }
        }
      </style>
    </head>
    <body>
  `;

  // Header
  if (layout.mostrar_logo && workshopData.workshopLogo && layout.template_base === 'logo_grande') {
    html += `<img src="${workshopData.workshopLogo}" style="${logoStyle}" />`;
  }

  html += `<div class="center bold" style="font-size: ${baseFontSize + 2}px;">${workshopData.workshopName}</div>`;
  
  if (layout.mostrar_endereco && workshopData.endereco) {
    html += `<div class="center">${workshopData.endereco}</div>`;
  } else if (layout.mostrar_endereco) {
    html += `<div class="center">Av. Exemplo, 123 - Centro</div>`; // Fallback for mock
  }

  if (layout.mostrar_telefone && workshopData.telefone) {
    html += `<div class="center">Tel: ${workshopData.telefone}</div>`;
  } else if (layout.mostrar_telefone) {
    html += `<div class="center">Tel: (11) 99999-9999</div>`;
  }

  if (layout.cabecalho) {
    html += `<div class="center" style="margin-top: ${paddingY}px; white-space: pre-wrap;">${layout.cabecalho}</div>`;
  }

  html += getDashedLine();
  
  let title = "CUPOM NÃO FISCAL";
  if (layout.tipo_cupom === 'abertura_caixa') title = "ABERTURA DE CAIXA";
  if (layout.tipo_cupom === 'fechamento_caixa') title = "FECHAMENTO DE CAIXA";
  if (layout.tipo_cupom === 'os') title = "ORDEM DE SERVIÇO";
  
  html += `<h2>${title}</h2>`;

  // Body
  if (layout.tipo_cupom === 'venda') {
    if (data === 'mock') {
      if (layout.template_base === 'minimalista' || layout.template_base === 'compacto') {
         html += `<table><tr><td>1x Pneu Aro 15</td><td class="right">R$ 350,00</td></tr><tr><td>2x Óleo 5W40</td><td class="right">R$ 100,00</td></tr></table>`;
      } else {
         html += `
           <table>
            <thead><tr><th>Desc / Qtd x Un</th><th class="right">Total</th></tr></thead>
            <tbody>
              <tr><td colspan="2" class="bold">Pneu Aro 15</td></tr>
              <tr><td style="color:#444">1x R$ 350,00</td><td class="right">R$ 350,00</td></tr>
              <tr><td colspan="2" class="bold">Óleo Motor 5W40</td></tr>
              <tr><td style="color:#444">2x R$ 50,00</td><td class="right">R$ 100,00</td></tr>
            </tbody>
           </table>
         `;
      }
      html += getDashedLine();
      html += `<table><tr class="bold" style="font-size: ${baseFontSize + 2}px;"><td>TOTAL:</td><td class="right">R$ 450,00</td></tr></table>`;
    } else {
      // Real Cupom Data
      const cupom = data as CupomData;
      html += `<div class="center" style="font-size: ${baseFontSize - 2}px;">Emissão: ${cupom.data}</div>`;
      html += getDashedLine();
      html += `<div class="center bold" style="font-size: ${baseFontSize}px; margin-bottom: ${paddingY}px;">CUPOM NÃO FISCAL</div>`;
      html += `<div class="center" style="font-size: ${baseFontSize - 2}px; margin-bottom: ${paddingY}px;">DETALHAMENTO DA COMPRA</div>`;
      html += getDashedLine();

      html += `<table>`;
      if (layout.template_base !== 'minimalista' && layout.template_base !== 'compacto') {
        html += `<thead><tr style="font-size: ${baseFontSize - 2}px; text-transform: uppercase;"><th style="padding-bottom: 4px;" colspan="3">Código - Descrição</th></tr></thead>`;
      }
      html += `<tbody>`;
      
      cupom.itens.forEach((item, i) => {
        const cod = String(i + 1).padStart(3, '0');
        if (layout.template_base === 'minimalista' || layout.template_base === 'compacto') {
          html += `<tr style="font-size: ${baseFontSize - 1}px;"><td style="padding-right: 4px;">${cod}</td><td>${item.nome}</td><td class="right">${item.qtd}x ${brl(item.preco)} = ${brl(item.preco * item.qtd)}</td></tr>`;
        } else {
          html += `
            <tr><td colspan="3" style="font-weight: bold; padding-top: 6px; font-size: ${baseFontSize - 1}px;">${cod} - ${item.nome}</td></tr>
            <tr style="border-bottom: 1px dashed #e5e5e5;">
              <td style="color: #333; padding-bottom: 6px; font-size: ${baseFontSize - 2}px;">QTD: ${Number(item.qtd)} UN</td>
              <td style="color: #333; padding-bottom: 6px; font-size: ${baseFontSize - 2}px;">VL UN: ${brl(item.preco)}</td>
              <td class="right bold" style="padding-bottom: 6px; font-size: ${baseFontSize - 1}px;">${brl(item.preco * item.qtd)}</td>
            </tr>
          `;
        }
      });
      html += `</tbody></table>`;
      html += getDashedLine();
      
      html += `<table>`;
      html += `<tr><td>Subtotal:</td><td class="right">${brl(cupom.subtotal)}</td></tr>`;
      if (cupom.desconto > 0) {
        html += `<tr><td>Desconto:</td><td class="right">- ${brl(cupom.desconto)}</td></tr>`;
      }
      html += `<tr class="bold" style="font-size: ${baseFontSize + 2}px;"><td style="padding-top: 5px;">TOTAL:</td><td class="right" style="padding-top: 5px;">${brl(cupom.total)}</td></tr>`;
      html += `</table>`;

      html += getDashedLine();
      
      html += `<table><tr><td colspan="2" class="bold" style="padding-bottom: 5px;">PAGAMENTOS:</td></tr>`;
      cupom.pagamentos.forEach(p => {
        html += `<tr><td>- ${p.forma.toUpperCase()}</td><td class="right">${brl(p.valor)}</td></tr>`;
      });
      if (cupom.recebido) {
        html += `<tr><td>Recebido:</td><td class="right">${brl(cupom.recebido)}</td></tr>`;
        html += `<tr><td>Troco:</td><td class="right">${brl(cupom.troco || 0)}</td></tr>`;
      }
      html += `</table>`;

      // Tributos Aproximados (Lei 12.741/2012)
      const tribAprox = cupom.total * 0.18; // 18% baseline approx
      html += getDashedLine();
      html += `<div class="center" style="font-size: ${baseFontSize - 2}px; line-height: 1.4;">`;
      html += `Informação dos Tributos Totais Incidentes<br>(Lei Federal 12.741/2012)<br>`;
      html += `Tributos Aproximados: ${brl(tribAprox)} (18,00%)<br>`;
      html += `Fonte: IBPT</div>`;

      // Placeholder QR Code NFC-e style
      html += getDashedLine();
      html += `<div class="center bold" style="font-size: ${baseFontSize - 1}px; margin-bottom: 10px;">Consulte via Leitor de QR Code</div>`;
      html += `<div style="margin: 0 auto 10px; width: 120px; height: 120px; border: 2px solid #000; padding: 4px; display: flex; align-items: center; justify-content: center; background: repeating-linear-gradient(45deg, #000, #000 2px, #fff 2px, #fff 4px);">
        <div style="background: #fff; padding: 5px; border: 2px solid #000; font-size: 10px; font-weight: bold; text-align: center; text-transform: uppercase;">QR CODE<br>NÃO FISCAL</div>
      </div>`;

      if (layout.mostrar_obs && cupom.observacao) {
        html += getDashedLine();
        html += `<div><strong style="font-size: ${baseFontSize - 1}px;">Observações:</strong><br><span style="font-size: ${baseFontSize - 2}px;">${cupom.observacao}</span></div>`;
      }
    }
  } else {
    html += `<div class="center">Conteúdo dinâmico de ${title} não implementado no mock genérico.</div>`;
  }

  if (layout.mostrar_rodape) {
    html += getDashedLine();
    html += `<div class="center bold" style="margin-top: ${10 + paddingY}px; font-size: ${baseFontSize + 1}px;">OBRIGADO PELA PREFERÊNCIA!</div>`;
    
    if (layout.tipo_cupom === 'venda' && data !== 'mock') {
        const c = data as CupomData;
        if (c.operador) {
            html += `<div class="center" style="font-size: ${baseFontSize - 2}px; margin-top: 5px; color: #333;">Operador(a): ${c.operador}</div>`;
        }
    }
    
    if (layout.rodape) {
      html += `<div class="center" style="margin-top: ${paddingY}px; white-space: pre-wrap; font-size: ${baseFontSize - 2}px; color: #444;">${layout.rodape}</div>`;
    }
  }

  html += `
    </body>
    </html>
  `;

  return html;
}
