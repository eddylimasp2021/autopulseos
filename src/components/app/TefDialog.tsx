import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Loader2, CheckCircle2, XCircle, Printer } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { iniciarTransacaoTef, type TefTransactionConfig, type TefPaymentRequest } from "@/lib/tefClient";
import { createTefTransaction, updateTefTransaction } from "@/lib/tef.functions";

interface TefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: TefTransactionConfig;
  valor: number;
  tipoPagamento: string; // 'cartao', 'cartao_credito', 'cartao_debito', 'pix'
  pdvVendaId?: string; // Optional if starting before closing sale
  onSuccess: (nsu: string, receipts: { cliente?: string; loja?: string }) => void;
  onCancel: () => void;
}

export function TefDialog({ open, onOpenChange, config, valor, tipoPagamento, pdvVendaId, onSuccess, onCancel }: TefDialogProps) {
  const [step, setStep] = useState<"initial" | "processing" | "success" | "error">("initial");
  const [tipo, setTipo] = useState<"credito" | "debito" | "pix">("credito");
  const [parcelas, setParcelas] = useState(1);
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [receipts, setReceipts] = useState<{cliente?: string, loja?: string}>({});
  const [nsu, setNsu] = useState("");
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const fnCreateTx = useServerFn(createTefTransaction);
  const fnUpdateTx = useServerFn(updateTefTransaction);

  // Map initial tipoPagamento
  useEffect(() => {
    if (tipoPagamento?.toLowerCase().includes("débito") || tipoPagamento?.toLowerCase().includes("debito")) setTipo("debito");
    else if (tipoPagamento?.toLowerCase() === "pix") setTipo("pix");
    else setTipo("credito");
  }, [tipoPagamento]);

  const handleStartTransaction = async () => {
    setStep("processing");
    setProgressMsg("Iniciando Transação TEF...");
    setErrorMsg("");

    let currentTxId: string | null = null;
    try {
      // 1. Create transaction record in DB
      const reqTxId = await fnCreateTx({ data: { valor, tipo, pdv_venda_id: pdvVendaId } });
      setTransactionId(reqTxId);
      currentTxId = reqTxId;

      // 2. Call local TEF Service
      const req: TefPaymentRequest = { valor, tipo, parcelas, pdv_venda_id: pdvVendaId };
      const res = await iniciarTransacaoTef(config, req, (msg) => setProgressMsg(msg));

      // 3. Handle Result
      if (res.sucesso) {
        setStep("success");
        setReceipts({ cliente: res.comprovante_cliente, loja: res.comprovante_loja });
        setNsu(res.nsu || "");
        
        // 4. Update DB as approved
        await fnUpdateTx({ data: { 
          id: reqTxId, 
          status: "aprovado", 
          nsu: res.nsu, 
          rede: res.rede, 
          comprovante_cliente: res.comprovante_cliente, 
          comprovante_loja: res.comprovante_loja 
        }});

      } else {
        throw new Error(res.mensagem || "Transação Negada");
      }

    } catch (err: any) {
      setStep("error");
      setErrorMsg(err.message || "Ocorreu um erro na transação.");
      
      // Update DB as denied/error if we created it
      if (currentTxId) {
        await fnUpdateTx({ data: { id: currentTxId, status: "negado" } }).catch(console.error);
      }
    }
  };

  const handlePrint = () => {
    if (!receipts.loja && !receipts.cliente) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<pre style="font-family: monospace; font-size: 12px;">${receipts.loja || receipts.cliente}</pre>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleCloseSuccess = () => {
    onSuccess(nsu, receipts);
    onOpenChange(false);
  };

  const handleCancelClick = async () => {
    if (transactionId && step === "error") {
      await fnUpdateTx({ data: { id: transactionId, status: "cancelado" } }).catch(console.error);
    }
    onCancel();
    onOpenChange(false);
  };

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setStep("initial");
      setProgressMsg("");
      setErrorMsg("");
      setTransactionId(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val && step === "processing") return; // Prevent closing while processing
      if (!val) handleCancelClick();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Integração TEF
          </DialogTitle>
          <DialogDescription>
            Processamento de pagamento via Pinpad
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center justify-center min-h-[200px] text-center">
          
          {step === "initial" && (
            <div className="w-full space-y-4">
              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                <p className="text-sm text-muted-foreground mb-1">Valor da Transação</p>
                <p className="text-3xl font-bold text-primary">
                  R$ {valor.toFixed(2).replace('.', ',')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="space-y-2">
                  <Label>Operação</Label>
                  <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credito">Crédito</SelectItem>
                      <SelectItem value="debito">Débito</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {tipo === "credito" && (
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <Input 
                      type="number" 
                      min={1} max={12} 
                      value={parcelas} 
                      onChange={e => setParcelas(Math.max(1, parseInt(e.target.value) || 1))} 
                    />
                  </div>
                )}
              </div>

              <Button className="w-full mt-4" size="lg" onClick={handleStartTransaction}>
                Iniciar Transação
              </Button>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
              <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Processando</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{progressMsg}</p>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300 w-full">
              <div className="h-20 w-20 bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <div className="space-y-1 w-full">
                <h3 className="text-xl font-semibold text-green-600">Transação Aprovada</h3>
                <p className="text-muted-foreground">NSU: {nsu}</p>
              </div>
              <div className="flex gap-3 w-full mt-4">
                <Button variant="outline" className="flex-1" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimir
                </Button>
                <Button className="flex-1" onClick={handleCloseSuccess}>
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300 w-full">
              <div className="h-20 w-20 bg-red-500/10 rounded-full flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-red-600">Erro na Transação</h3>
                <p className="text-muted-foreground">{errorMsg}</p>
              </div>
              <div className="flex gap-3 w-full mt-4">
                <Button variant="outline" className="flex-1" onClick={handleCancelClick}>
                  Cancelar Pagamento
                </Button>
                <Button className="flex-1" onClick={() => setStep("initial")}>
                  Tentar Novamente
                </Button>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
