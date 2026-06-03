import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTefConfig, upsertTefConfig, type TefConfigInputType } from "@/lib/tef.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CreditCard, Save, Wifi, Loader2 } from "lucide-react";

export function TefConfigTab() {
  const qc = useQueryClient();
  const fnGetConfig = useServerFn(getTefConfig);
  const fnUpsertConfig = useServerFn(upsertTefConfig);

  const { data: config, isLoading } = useQuery({
    queryKey: ["tefConfig"],
    queryFn: () => fnGetConfig()
  });

  const [form, setForm] = useState<TefConfigInputType>({
    ativo: false,
    ip_servidor: "127.0.0.1",
    porta: 8080,
    empresa: "00000000",
    terminal: "SE000001",
    cnpj: "",
    timeout: 30
  });

  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        ativo: config.ativo,
        ip_servidor: config.ip_servidor,
        porta: config.porta,
        empresa: config.empresa,
        terminal: config.terminal,
        cnpj: config.cnpj || "",
        timeout: config.timeout
      });
    }
  }, [config]);

  const mSave = useMutation({
    mutationFn: (data: TefConfigInputType) => fnUpsertConfig({ data }),
    onSuccess: () => {
      toast.success("Configuração do TEF salva com sucesso");
      qc.invalidateQueries({ queryKey: ["tefConfig"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao salvar configuração do TEF");
    }
  });

  const handleSave = () => {
    mSave.mutate(form);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch(`http://${form.ip_servidor}:${form.porta}/teste`, {
        method: "GET",
        signal: controller.signal
      }).catch(() => null); // ignore fetch error to handle it properly below
      
      clearTimeout(id);
      
      if (res && res.ok) {
        toast.success("Conexão com Servidor TEF bem sucedida!");
      } else {
        toast.warning("Servidor indisponível ou resposta inválida. O PDV operará em Modo Simulado.", { duration: 5000 });
      }
    } catch (error) {
      toast.warning("Servidor indisponível. O PDV operará em Modo Simulado.", { duration: 5000 });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>;
  }

  return (
    <div className="glass rounded-2xl p-6 space-y-6 max-w-2xl">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Transferência Eletrônica de Fundos (TEF)</h2>
            <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-full">
              <Switch checked={form.ativo} onCheckedChange={v => setForm({ ...form, ativo: v })} />
              <Label className="text-sm font-medium cursor-pointer" onClick={() => setForm({ ...form, ativo: !form.ativo })}>
                {form.ativo ? "Ativo" : "Inativo"}
              </Label>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Configure a comunicação local com o serviço do SiTef para pagamentos integrados no PDV. Se o serviço não for alcançado, as vendas funcionarão em Modo Simulado.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="space-y-2">
          <Label>IP do Servidor / Host</Label>
          <Input 
            value={form.ip_servidor} 
            onChange={e => setForm({ ...form, ip_servidor: e.target.value })} 
            placeholder="Ex: 127.0.0.1" 
          />
        </div>
        <div className="space-y-2">
          <Label>Porta</Label>
          <Input 
            type="number" 
            value={form.porta} 
            onChange={e => setForm({ ...form, porta: Number(e.target.value) })} 
          />
        </div>
        <div className="space-y-2">
          <Label>Código da Empresa</Label>
          <Input 
            value={form.empresa} 
            onChange={e => setForm({ ...form, empresa: e.target.value })} 
            placeholder="00000000" 
          />
        </div>
        <div className="space-y-2">
          <Label>Terminal</Label>
          <Input 
            value={form.terminal} 
            onChange={e => setForm({ ...form, terminal: e.target.value })} 
            placeholder="SE000001" 
          />
        </div>
        <div className="space-y-2">
          <Label>CNPJ da Loja</Label>
          <Input 
            value={form.cnpj || ""} 
            onChange={e => setForm({ ...form, cnpj: e.target.value })} 
            placeholder="00.000.000/0001-00" 
          />
        </div>
        <div className="space-y-2">
          <Label>Timeout (segundos)</Label>
          <Input 
            type="number" 
            value={form.timeout} 
            onChange={e => setForm({ ...form, timeout: Number(e.target.value) })} 
          />
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-border/40">
        <Button variant="outline" onClick={handleTestConnection} disabled={isTesting || !form.ip_servidor}>
          {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wifi className="h-4 w-4 mr-2" />}
          Testar Conexão Local
        </Button>
        <Button onClick={handleSave} disabled={mSave.isPending}>
          {mSave.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
