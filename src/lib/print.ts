export interface CupomData {
  itens: { nome: string; qtd: number; preco: number }[];
  subtotal: number;
  desconto: number;
  total: number;
  formaPagamento: string;
  recebido?: number;
  troco?: number;
  observacao?: string;
  data: string;
}

export function imprimirCupomNaoFiscal(data: CupomData) {
  const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
  
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Cupom Não Fiscal</title>
      <style>
        body {
          font-family: monospace;
          width: 80mm;
          margin: 0 auto;
          padding: 10px;
          color: #000;
          font-size: 12px;
        }
        h2 { text-align: center; font-size: 16px; margin: 0 0 10px; }
        .center { text-align: center; }
        .dashed-line { border-bottom: 1px dashed #000; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 2px 0; }
        th { border-bottom: 1px dashed #000; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .total-row td { padding-top: 5px; }
        .footer { text-align: center; margin-top: 20px; font-size: 11px; }
        @media print {
          @page { margin: 0; }
          body { margin: 0; padding: 5px; width: 100%; }
        }
      </style>
    </head>
    <body>
      <h2>CUPOM NÃO FISCAL</h2>
      <div class="center">Data: ${data.data}</div>
      <div class="dashed-line"></div>
      
      <table>
        <thead>
          <tr>
            <th>Qtd</th>
            <th>Item</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.itens.map(item => `
            <tr>
              <td>${item.qtd}</td>
              <td>${item.nome.substring(0, 20)}${item.nome.length > 20 ? '...' : ''}</td>
              <td class="right">${brl(item.preco * item.qtd)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="dashed-line"></div>
      
      <table>
        <tr>
          <td>Subtotal:</td>
          <td class="right">${brl(data.subtotal)}</td>
        </tr>
        ${data.desconto > 0 ? `
        <tr>
          <td>Desconto:</td>
          <td class="right">- ${brl(data.desconto)}</td>
        </tr>
        ` : ''}
        <tr class="total-row bold" style="font-size: 14px;">
          <td>TOTAL:</td>
          <td class="right">${brl(data.total)}</td>
        </tr>
      </table>

      <div class="dashed-line"></div>
      
      <table>
        <tr>
          <td>Forma Pag.:</td>
          <td class="right">${data.formaPagamento.toUpperCase()}</td>
        </tr>
        ${data.formaPagamento === 'dinheiro' && data.recebido ? `
        <tr>
          <td>Recebido:</td>
          <td class="right">${brl(data.recebido)}</td>
        </tr>
        <tr>
          <td>Troco:</td>
          <td class="right">${brl(data.troco || 0)}</td>
        </tr>
        ` : ''}
      </table>

      ${data.observacao ? `
      <div class="dashed-line"></div>
      <div><strong>Obs:</strong> ${data.observacao}</div>
      ` : ''}

      <div class="footer">
        OBRIGADO PELA PREFERÊNCIA!<br>
        Sistema Garagem OS
      </div>

      <script>
        window.onload = function() {
          setTimeout(() => {
            window.print();
            window.close();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  w.document.open();
  w.document.write(html);
  w.document.close();
}
