import { useState, useMemo } from "react";
import { Calculator } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const VALORES = [
  { tipo: "cedula", valor: 200 },
  { tipo: "cedula", valor: 100 },
  { tipo: "cedula", valor: 50 },
  { tipo: "cedula", valor: 20 },
  { tipo: "cedula", valor: 10 },
  { tipo: "cedula", valor: 5 },
  { tipo: "cedula", valor: 2 },
  { tipo: "moeda", valor: 1 },
  { tipo: "moeda", valor: 0.50 },
  { tipo: "moeda", valor: 0.25 },
  { tipo: "moeda", valor: 0.10 },
  { tipo: "moeda", valor: 0.05 },
];

export function ContadorMoedas({ onConfirm }: { onConfirm: (total: number) => void }) {
  const [quantidades, setQuantidades] = useState<Record<number, number>>({});
  const [open, setOpen] = useState(false);

  const total = useMemo(() => {
    return VALORES.reduce((acc, { valor }) => acc + (quantidades[valor] || 0) * valor, 0);
  }, [quantidades]);

  const handleChange = (valor: number, qtdStr: string) => {
    const q = parseInt(qtdStr, 10);
    setQuantidades(prev => ({ ...prev, [valor]: isNaN(q) ? 0 : q }));
  };

  const handleConfirmar = () => {
    onConfirm(total);
    setOpen(false);
    setQuantidades({}); // reseta após uso
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" type="button" className="gap-2 w-full mt-2 border-dashed bg-secondary/20 hover:bg-secondary/50">
          <Calculator className="h-4 w-4" />
          Contador de Cédulas e Moedas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Contador de Dinheiro</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto p-1 styled-scrollbar mt-2">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground border-b border-border/40 pb-2">Cédulas</h4>
            {VALORES.filter(v => v.tipo === "cedula").map(({ valor }) => (
              <div key={valor} className="flex items-center gap-2">
                <Label className="w-16 text-right tabular-nums text-xs font-medium">R$ {valor.toFixed(2)}</Label>
                <div className="relative flex-1">
                  <Input 
                    type="number" 
                    min="0" 
                    value={quantidades[valor] || ""} 
                    onChange={e => handleChange(valor, e.target.value)}
                    className="h-9 text-right pr-3 bg-secondary/30 tabular-nums focus:ring-1 focus:ring-primary/50"
                    placeholder="Qtd"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground border-b border-border/40 pb-2">Moedas</h4>
            {VALORES.filter(v => v.tipo === "moeda").map(({ valor }) => (
              <div key={valor} className="flex items-center gap-2">
                <Label className="w-16 text-right tabular-nums text-xs font-medium">R$ {valor.toFixed(2)}</Label>
                <div className="relative flex-1">
                  <Input 
                    type="number" 
                    min="0" 
                    value={quantidades[valor] || ""} 
                    onChange={e => handleChange(valor, e.target.value)}
                    className="h-9 text-right pr-3 bg-secondary/30 tabular-nums focus:ring-1 focus:ring-primary/50"
                    placeholder="Qtd"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/40">
          <div className="text-sm">
            Total Calculado: <div className="font-bold text-2xl text-primary tabular-nums mt-1">R$ {total.toFixed(2).replace(".", ",")}</div>
          </div>
          <Button onClick={handleConfirmar} className="px-6">Aplicar Valor</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
