import { CupomData } from "./print";

function openPrintWindow(htmlContent: string) {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  w.document.open();
  w.document.write(htmlContent);
  w.document.close();
}

export type EtiquetaLayout = "A4_Pimaco" | "Argox_40x20" | "Termica_80mm";
export interface EtiquetaItem { 
  nome: string; 
  preco: number; 
  codigo: string; 
  quantidade: number; 
}

export function imprimirEtiquetas(itens: EtiquetaItem[], layout: EtiquetaLayout) {
  const brl = (n: number) => \`R$ \${n.toFixed(2).replace(".", ",")}\`;
  
  // Expandir os itens pela quantidade desejada
  const etiquetas: EtiquetaItem[] = [];
  itens.forEach(item => {
    for (let i = 0; i < item.quantidade; i++) etiquetas.push(item);
  });

  let css = "";
  let bodyContent = "";

  if (layout === "A4_Pimaco") {
    // Layout estilo folha A4 com etiquetas de aprox 63x31mm (3 colunas, várias linhas)
    css = \`
      body { margin: 0; padding: 10mm 4mm; font-family: sans-serif; }
      .page { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; justify-content: center; }
      .label { 
        width: 63mm; height: 31mm; 
        border: 1px dashed #ccc; 
        box-sizing: border-box; 
        padding: 2mm; 
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center;
      }
      .name { font-size: 11px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; margin-bottom: 2px; }
      .price { font-size: 14px; font-weight: 900; margin-bottom: 2px; }
      .barcode-container svg { height: 12mm; max-width: 100%; }
      @media print { 
        @page { margin: 0; size: A4; } 
        body { padding: 12mm 4mm; }
        .label { border: none; } 
      }
    \`;
    bodyContent = \`<div class="page">\` + etiquetas.map(e => \`
      <div class="label">
        <div class="name">\${e.nome}</div>
        <div class="price">\${brl(e.preco)}</div>
        <div class="barcode-container">
           <svg class="barcode" 
                jsbarcode-value="\${e.codigo}" 
                jsbarcode-format="CODE128" 
                jsbarcode-displayvalue="true" 
                jsbarcode-fontsize="12"
                jsbarcode-height="30"
                jsbarcode-width="1.5"
                jsbarcode-margin="0">
           </svg>
        </div>
      </div>
    \`).join('') + \`</div>\`;

  } else if (layout === "Argox_40x20") {
    // Bobina contínua pequena
    css = \`
      body { margin: 0; padding: 0; font-family: sans-serif; background: #eee; }
      .label { 
        width: 40mm; height: 20mm; 
        background: #fff;
        box-sizing: border-box; 
        padding: 1mm; 
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center;
        page-break-after: always;
      }
      .name { font-size: 8px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; line-height: 1; margin-bottom: 1px;}
      .price { font-size: 10px; font-weight: 900; line-height: 1; margin-bottom: 1px; }
      .barcode-container svg { height: 9mm; max-width: 100%; }
      @media print { 
        @page { margin: 0; size: 40mm 20mm; } 
        body { background: #fff; }
      }
    \`;
    bodyContent = etiquetas.map(e => \`
      <div class="label">
        <div class="name">\${e.nome}</div>
        <div class="price">\${brl(e.preco)}</div>
        <div class="barcode-container">
           <svg class="barcode" jsbarcode-value="\${e.codigo}" jsbarcode-format="CODE128" jsbarcode-displayvalue="true" jsbarcode-fontsize="10" jsbarcode-height="25" jsbarcode-width="1" jsbarcode-margin="0"></svg>
        </div>
      </div>
    \`).join('');

  } else if (layout === "Termica_80mm") {
    css = \`
      body { margin: 0 auto; width: 78mm; padding: 5px; font-family: sans-serif; }
      .label { 
        border-bottom: 1px dashed #000;
        padding: 10px 0; 
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center;
      }
      .name { font-size: 14px; font-weight: bold; margin-bottom: 3px; }
      .price { font-size: 18px; font-weight: 900; margin-bottom: 5px; }
      .barcode-container svg { height: 18mm; max-width: 100%; }
      @media print { @page { margin: 0; } body { padding: 2mm; width: 100%; } }
    \`;
    bodyContent = etiquetas.map(e => \`
      <div class="label">
        <div class="name">\${e.nome}</div>
        <div class="price">\${brl(e.preco)}</div>
        <div class="barcode-container">
           <svg class="barcode" jsbarcode-value="\${e.codigo}" jsbarcode-format="CODE128" jsbarcode-displayvalue="true" jsbarcode-fontsize="14" jsbarcode-height="40" jsbarcode-width="1.8" jsbarcode-margin="0"></svg>
        </div>
      </div>
    \`).join('');
  }

  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Impressão de Etiquetas</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <style>\${css}</style>
    </head>
    <body>
      \${bodyContent}
      <script>
        window.onload = function() { 
          JsBarcode(".barcode").init();
          setTimeout(() => { window.print(); window.close(); }, 500); 
        };
      </script>
    </body>
    </html>
  \`;
  openPrintWindow(html);
}
