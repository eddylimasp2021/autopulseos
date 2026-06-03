import { supabase } from "@/integrations/supabase/client";
import { generateReceiptHtml, PrintWorkshopData } from "./printTemplates";
import type { PrintLayout } from "./printLayouts.functions";

export interface CupomData {
  itens: { nome: string; qtd: number; preco: number }[];
  subtotal: number;
  desconto: number;
  total: number;
  pagamentos: { forma: string; valor: number }[];
  recebido?: number;
  troco?: number;
  observacao?: string;
  data: string;
  operador?: string;
}

function openPrintWindow(htmlContent: string) {
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) return;
  w.document.open();
  
  // Inject the auto-print script
  const script = `
    <script>
      window.onload = function() {
        setTimeout(() => {
          window.print();
          window.close();
        }, 300);
      };
    </script>
  `;
  w.document.write(htmlContent.replace('</body>', script + '</body>'));
  w.document.close();
}

async function getWorkshopPrintData(): Promise<PrintWorkshopData | null> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;

  const { data: member } = await supabase
    .from('workshop_members')
    .select('workshops(id, nome, logo_url, endereco, telefone)')
    .eq('user_id', session.session.user.id)
    .single();

  if (!member || !member.workshops) return null;
  const w = Array.isArray(member.workshops) ? member.workshops[0] : member.workshops;
  
  return {
    workshopName: w.nome,
    workshopLogo: w.logo_url || undefined,
    endereco: w.endereco || undefined,
    telefone: w.telefone || undefined,
  };
}

async function getPrintLayoutPadrao(tipo_cupom: string): Promise<PrintLayout | null> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;

  const { data: member } = await supabase
    .from('workshop_members')
    .select('workshop_id')
    .eq('user_id', session.session.user.id)
    .single();

  if (!member) return null;

  const { data } = await supabase
    .from('print_layouts')
    .select('*')
    .eq('workshop_id', member.workshop_id)
    .eq('tipo_cupom', tipo_cupom)
    .eq('is_padrao', true)
    .single();

  return data as PrintLayout | null;
}

const defaultLayout: Partial<PrintLayout> = {
  template_base: 'detalhado',
  largura_papel: '80mm',
  tamanho_fonte: 'normal',
  espacamento: 'normal',
  mostrar_logo: false,
  mostrar_endereco: true,
  mostrar_telefone: true,
  mostrar_rodape: true,
  mostrar_obs: true,
};

export async function imprimirCupomNaoFiscal(data: CupomData) {
  // O ideal seria criar a janela síncrona antes do await para não bloquear popups
  // mas como estamos refatorando sem mudar a interface das chamadas de todo o projeto
  // vamos torcer para o popup não ser bloqueado ou abrir primeiro um blank.
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) {
    alert("O popup de impressão foi bloqueado pelo navegador. Por favor, permita popups neste site.");
    return;
  }
  
  const workshopData = await getWorkshopPrintData() || { workshopName: "Garagem OS" };
  let layout = await getPrintLayoutPadrao('venda');
  
  if (!layout) {
    layout = { ...defaultLayout, tipo_cupom: 'venda' } as PrintLayout;
  }

  const html = generateReceiptHtml(layout, workshopData, data);
  
  w.document.open();
  
  const script = `<script>window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 300); };</script>`;
  w.document.write(html.replace('</body>', script + '</body>'));
  w.document.close();
}

// TODO: Refactor imprimirAberturaCaixa and imprimirFechamentoCaixa to use the same logic
export async function imprimirAberturaCaixa(operador: string, saldoInicial: number) {
  const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
  
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) return;

  const workshopData = await getWorkshopPrintData() || { workshopName: "Garagem OS" };
  let layout = await getPrintLayoutPadrao('abertura_caixa');
  
  if (!layout) {
    layout = { ...defaultLayout, tipo_cupom: 'abertura_caixa' } as PrintLayout;
  }

  // Fallback to static for now or we can implement the HTML inside generateReceiptHtml
  const width = layout.largura_papel === '80mm' ? '80mm' : '58mm';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: monospace; width: ${width}; margin: 0 auto; padding: 10px; font-size: 12px; }
        h2 { text-align: center; font-size: 16px; margin: 0 0 10px; }
        .center { text-align: center; }
        .dashed-line { border-bottom: 1px dashed #000; margin: 10px 0; }
        @media print { @page { margin: 0; } body { margin: 0; padding: 5px; width: 100%; } }
      </style>
    </head>
    <body>
      ${layout.mostrar_logo && workshopData.workshopLogo && layout.template_base === 'logo_grande' ? `<img src="${workshopData.workshopLogo}" style="max-width:80%;max-height:80px;margin:0 auto 10px;display:block;filter:grayscale(100%);" />` : ''}
      <div class="center bold">${workshopData.workshopName}</div>
      ${layout.mostrar_endereco && workshopData.endereco ? `<div class="center">${workshopData.endereco}</div>` : ''}
      <div class="dashed-line"></div>
      <h2>ABERTURA DE CAIXA</h2>
      <div class="center">Data: ${new Date().toLocaleString('pt-BR')}</div>
      <div class="dashed-line"></div>
      <div><strong>Operador:</strong> ${operador}</div>
      <div><strong>Fundo de Troco:</strong> ${brl(saldoInicial)}</div>
      <div class="dashed-line"></div>
      <div class="center" style="margin-top: 30px;">
        ________________________________<br>
        Assinatura do Operador
      </div>
      <script>
        window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 300); };
      </script>
    </body>
    </html>
  `;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export async function imprimirFechamentoCaixa(dados: { operador: string; dataAbertura: string; saldoInicial: number; dinheiro: number; pix: number; credito: number; debito: number; totalVendas: number; saldoFinal: number; }) {
  const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
  
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) return;

  const workshopData = await getWorkshopPrintData() || { workshopName: "Garagem OS" };
  let layout = await getPrintLayoutPadrao('fechamento_caixa');
  if (!layout) layout = { ...defaultLayout, tipo_cupom: 'fechamento_caixa' } as PrintLayout;

  const width = layout.largura_papel === '80mm' ? '80mm' : '58mm';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: monospace; width: ${width}; margin: 0 auto; padding: 10px; font-size: 12px; }
        h2 { text-align: center; font-size: 16px; margin: 0 0 10px; }
        .center { text-align: center; }
        .dashed-line { border-bottom: 1px dashed #000; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        @media print { @page { margin: 0; } body { margin: 0; padding: 5px; width: 100%; } }
      </style>
    </head>
    <body>
      ${layout.mostrar_logo && workshopData.workshopLogo && layout.template_base === 'logo_grande' ? `<img src="${workshopData.workshopLogo}" style="max-width:80%;max-height:80px;margin:0 auto 10px;display:block;filter:grayscale(100%);" />` : ''}
      <div class="center bold">${workshopData.workshopName}</div>
      <div class="dashed-line"></div>
      <h2>FECHAMENTO DE CAIXA</h2>
      <div class="center">Fechado em: ${new Date().toLocaleString('pt-BR')}</div>
      <div class="dashed-line"></div>
      <div><strong>Operador:</strong> ${dados.operador}</div>
      <div><strong>Abertura:</strong> ${new Date(dados.dataAbertura).toLocaleString('pt-BR')}</div>
      <div class="dashed-line"></div>
      
      <table>
        <tr><td>Fundo Inicial:</td><td class="right">${brl(dados.saldoInicial)}</td></tr>
        <tr><td>(+) Vendas Dinheiro:</td><td class="right">${brl(dados.dinheiro)}</td></tr>
        <tr><td>(+) Vendas PIX:</td><td class="right">${brl(dados.pix)}</td></tr>
        <tr><td>(+) Cartão Crédito:</td><td class="right">${brl(dados.credito)}</td></tr>
        <tr><td>(+) Cartão Débito:</td><td class="right">${brl(dados.debito)}</td></tr>
      </table>
      
      <div class="dashed-line"></div>
      <table>
        <tr class="bold"><td>Total de Vendas:</td><td class="right">${brl(dados.totalVendas)}</td></tr>
        <tr class="bold" style="font-size: 14px;"><td>SALDO EM CAIXA:</td><td class="right">${brl(dados.saldoFinal)}</td></tr>
      </table>
      <div class="center" style="font-size: 10px; margin-top: 5px;">* Saldo = Fundo Inicial + Vendas em Dinheiro</div>

      <div class="dashed-line"></div>
      <div class="center" style="margin-top: 30px;">
        ________________________________<br>
        Assinatura do Conferente
      </div>
      <script>
        window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 300); };
      </script>
    </body>
    </html>
  `;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
