import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Edit, Trash2, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { listPrintLayouts, createPrintLayout, updatePrintLayout, deletePrintLayout, PrintLayout } from "@/lib/printLayouts.functions";
import { getWorkshop } from "@/lib/configuracoes.functions";
import { generateReceiptHtml } from "@/lib/printTemplates";

export function PrintLayoutEditor() {
  const qc = useQueryClient();
  const fnList = useServerFn(listPrintLayouts);
  const fnCreate = useServerFn(createPrintLayout);
  const fnUpdate = useServerFn(updatePrintLayout);
  const fnDelete = useServerFn(deletePrintLayout);
  const fnGetW = useServerFn(getWorkshop);

  const { data: layouts = [], isLoading } = useQuery({
    queryKey: ["print-layouts"],
    queryFn: () => fnList()
  });

  const { data: workshop } = useQuery({
    queryKey: ["workshop-data-print"],
    queryFn: () => fnGetW()
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PrintLayout> | null>(null);

  const handleCreateNew = () => {
    setEditingId("new");
    setFormData({
      nome: "Novo Layout",
      tipo_cupom: "venda",
      template_base: "detalhado",
      largura_papel: "80mm",
      tamanho_fonte: "normal",
      espacamento: "normal",
      cabecalho: "",
      rodape: "Obrigado e volte sempre!",
      mostrar_logo: false,
      mostrar_endereco: true,
      mostrar_telefone: true,
      mostrar_rodape: true,
      mostrar_obs: true,
      is_padrao: false,
    });
  };

  const handleEdit = (l: PrintLayout) => {
    setEditingId(l.id);
    setFormData(l);
  };

  const mSave = useMutation({
    mutationFn: async (data: Partial<PrintLayout>) => {
      if (editingId === "new") {
        return fnCreate({ data: data as any });
      } else {
        return fnUpdate({ data: { id: editingId!, updates: data } });
      }
    },
    onSuccess: () => {
      toast.success("Layout salvo com sucesso!");
      qc.invalidateQueries({ queryKey: ["print-layouts"] });
      setEditingId(null);
      setFormData(null);
    },
    onError: (e) => toast.error(e.message)
  });

  const mDelete = useMutation({
    mutationFn: async (id: string) => fnDelete({ data: id }),
    onSuccess: () => {
      toast.success("Layout removido");
      qc.invalidateQueries({ queryKey: ["print-layouts"] });
    }
  });

  const mSetDefault = useMutation({
    mutationFn: async ({ id, tipo }: { id: string, tipo: string }) => fnUpdate({ data: { id, updates: { is_padrao: true, tipo_cupom: tipo as any } } }),
    onSuccess: () => {
      toast.success("Padrão atualizado");
      qc.invalidateQueries({ queryKey: ["print-layouts"] });
    }
  });

  const previewHtml = useMemo(() => {
    if (!formData || !workshop) return "";
    return generateReceiptHtml(
      formData,
      {
        workshopName: workshop.nome,
        workshopLogo: workshop.logo_url,
      },
      'mock'
    );
  }, [formData, workshop]);

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></div>;

  if (editingId && formData) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">
        {/* Editor Form */}
        <div className="glass rounded-2xl p-6 overflow-y-auto space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-xl font-semibold">{editingId === "new" ? "Criar Layout" : "Editar Layout"}</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
              <Button disabled={mSave.isPending} onClick={() => mSave.mutate(formData)}>
                {mSave.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <SaveIcon className="w-4 h-4 mr-2" />} Salvar
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do Layout</Label>
              <Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Cupom</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.tipo_cupom} onChange={e => setFormData({ ...formData, tipo_cupom: e.target.value as any })}>
                <option value="venda">Venda (PDV)</option>
                <option value="abertura_caixa">Abertura de Caixa</option>
                <option value="fechamento_caixa">Fechamento de Caixa</option>
                <option value="os">Ordem de Serviço</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Template Base</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.template_base} onChange={e => setFormData({ ...formData, template_base: e.target.value as any })}>
                <option value="detalhado">Detalhado</option>
                <option value="minimalista">Minimalista</option>
                <option value="logo_grande">Com Logo Grande</option>
                <option value="compacto">Compacto</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Largura do Papel</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.largura_papel} onChange={e => setFormData({ ...formData, largura_papel: e.target.value as any })}>
                <option value="80mm">80mm (Padrão)</option>
                <option value="58mm">58mm (Mini)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tamanho da Fonte</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.tamanho_fonte} onChange={e => setFormData({ ...formData, tamanho_fonte: e.target.value as any })}>
                <option value="pequena">Pequena</option>
                <option value="normal">Normal</option>
                <option value="grande">Grande</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Espaçamento</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.espacamento} onChange={e => setFormData({ ...formData, espacamento: e.target.value as any })}>
                <option value="compacto">Compacto (Menos papel)</option>
                <option value="normal">Normal</option>
                <option value="largo">Largo (Mais legível)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium">Campos Visíveis</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between">
                <Label>Mostrar Logomarca</Label>
                <Switch checked={formData.mostrar_logo} onCheckedChange={c => setFormData({ ...formData, mostrar_logo: c })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Mostrar Endereço</Label>
                <Switch checked={formData.mostrar_endereco} onCheckedChange={c => setFormData({ ...formData, mostrar_endereco: c })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Mostrar Telefone</Label>
                <Switch checked={formData.mostrar_telefone} onCheckedChange={c => setFormData({ ...formData, mostrar_telefone: c })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Mostrar Rodapé</Label>
                <Switch checked={formData.mostrar_rodape} onCheckedChange={c => setFormData({ ...formData, mostrar_rodape: c })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Mostrar Observações</Label>
                <Switch checked={formData.mostrar_obs} onCheckedChange={c => setFormData({ ...formData, mostrar_obs: c })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Tornar Padrão</Label>
                <Switch checked={formData.is_padrao} onCheckedChange={c => setFormData({ ...formData, is_padrao: c })} />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <Label>Texto de Cabeçalho (Opcional)</Label>
              <Textarea value={formData.cabecalho || ""} onChange={e => setFormData({ ...formData, cabecalho: e.target.value })} placeholder="Ex: CNPJ: 00.000.000/0001-00" />
            </div>
            <div className="space-y-2">
              <Label>Texto de Rodapé (Opcional)</Label>
              <Textarea value={formData.rodape || ""} onChange={e => setFormData({ ...formData, rodape: e.target.value })} placeholder="Volte Sempre!" />
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="glass rounded-2xl p-6 flex flex-col h-full">
          <h3 className="font-medium mb-4">Pré-visualização Ao Vivo</h3>
          <div className="flex-1 bg-neutral-100 rounded-lg overflow-hidden border relative flex justify-center p-4">
             <div className="bg-white shadow-xl h-full overflow-y-auto" style={{ width: formData.largura_papel === "58mm" ? "300px" : "400px" }}>
               <iframe 
                 srcDoc={previewHtml} 
                 className="w-full h-full border-none" 
                 title="Preview do Cupom"
               />
             </div>
          </div>
        </div>
      </div>
    );
  }

  const tipos = {
    venda: "Venda PDV",
    abertura_caixa: "Abertura de Caixa",
    fechamento_caixa: "Fechamento de Caixa",
    os: "Ordem de Serviço"
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Layouts de Impressão</h2>
          <p className="text-sm text-muted-foreground mt-1">Crie e gerencie os modelos de cupons impressos do sistema.</p>
        </div>
        <Button onClick={handleCreateNew}><Plus className="w-4 h-4 mr-2" /> Novo Layout</Button>
      </div>

      {layouts.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl border-border/50">
          <p className="text-muted-foreground mb-4">Nenhum layout personalizado encontrado.</p>
          <Button variant="outline" onClick={handleCreateNew}>Criar Primeiro Layout</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {layouts.map(l => (
            <div key={l.id} className="border bg-card p-4 rounded-xl flex flex-col relative">
              {l.is_padrao && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] uppercase font-bold px-2 py-1 rounded-bl-lg rounded-tr-xl flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Padrão
                </div>
              )}
              <h3 className="font-medium mt-2">{l.nome}</h3>
              <p className="text-sm text-muted-foreground mb-4">{tipos[l.tipo_cupom]} • {l.largura_papel}</p>
              
              <div className="mt-auto flex gap-2 pt-4 border-t border-border/50">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => handleEdit(l)}>
                  <Edit className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
                {!l.is_padrao && (
                  <Button variant="outline" size="sm" onClick={() => mSetDefault.mutate({ id: l.id, tipo: l.tipo_cupom })} title="Tornar Padrão">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={() => { if(confirm("Tem certeza?")) mDelete.mutate(l.id); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SaveIcon(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
}
