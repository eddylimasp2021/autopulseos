import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Package, Search, Plus, AlertTriangle, TrendingUp, TrendingDown, Pencil, Trash2, ArrowDownUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Check } from "lucide-react";
import Papa from "papaparse";
import { listEstoque, createEstoqueItem, updateEstoqueItem, deleteEstoqueItem, createMovimentacao, bulkImportEstoque } from "@/lib/estoque.functions";

export const Route = createFileRoute("/_authenticated/app/estoque")({ component: Page });

const Schema = z.object({
  nome: z.string().trim().min(1, "Obrigatório").max(160),
  codigo: z.string().trim().max(60).optional(),
  categoria: z.string().trim().max(60).optional(),
  unidade: z.string().trim().max(10).optional(),
  quantidade: z.string().optional(),
  qtd_minima: z.string().optional(),
  preco_custo: z.string().optional(),
  preco_venda: z.string().optional(),
  fornecedor: z.string().trim().max(120).optional(),
  observacoes: z.string().trim().max(1000).optional(),
});
type FormData = z.infer<typeof Schema>;

type Item = { id: string; nome: string; codigo: string | null; categoria: string | null; unidade: string | null; quantidade: number; qtd_minima: number; preco_custo: number; preco_venda: number; fornecedor: string | null };

function Page() {
  const [busca, setBusca] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [movItem, setMovItem] = useState<Item | null>(null);
  const qc = useQueryClient();

  const list = useServerFn(listEstoque);
  const create = useServerFn(createEstoqueItem);
  const update = useServerFn(updateEstoqueItem);
  const remove = useServerFn(deleteEstoqueItem);
  const mov = useServerFn(createMovimentacao);

  const { data: itens = [], isLoading } = useQuery({ queryKey: ["estoque"], queryFn: () => list() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["estoque"] });

  const mCreate = useMutation({
    mutationFn: (d: any) => create({ data: d }),
    onSuccess: () => { toast.success("Item cadastrado"); invalidate(); setOpenForm(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mUpdate = useMutation({
    mutationFn: (d: any) => update({ data: d }),
    onSuccess: () => { toast.success("Item atualizado"); invalidate(); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Item removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mMov = useMutation({
    mutationFn: (d: any) => mov({ data: d }),
    onSuccess: () => { toast.success("Movimentação registrada"); invalidate(); setMovItem(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const produtos = (itens as Item[]).filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.codigo ?? "").toLowerCase().includes(busca.toLowerCase()));
  const alertas = produtos.filter(p => Number(p.quantidade) <= Number(p.qtd_minima));
  const valorEstoque = produtos.reduce((s, p) => s + Number(p.quantidade) * Number(p.preco_custo), 0);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <Package className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Estoque</h1>
            <p className="text-sm text-muted-foreground mt-1">Controle de peças, entradas e saídas conectado às OS.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => {
            import("xlsx").then((XLSX) => {
              const data = produtos.map(p => ({
                "Nome": p.nome,
                "Código/SKU": p.codigo || "",
                "Categoria": p.categoria || "",
                "Estoque Atual": Number(p.quantidade),
                "Estoque Mínimo": Number(p.qtd_minima),
                "Preço de Custo": Number(p.preco_custo),
                "Preço de Venda": Number(p.preco_venda),
                "Fornecedor": p.fornecedor || "",
                "Unidade": p.unidade || "",
                "Status": Number(p.quantidade) <= Number(p.qtd_minima) ? "Estoque Baixo" : "OK"
              }));
              const ws = XLSX.utils.json_to_sheet(data);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Estoque");
              XLSX.writeFile(wb, "estoque_garagemos.xlsx");
            });
          }} className="inline-flex items-center gap-2 rounded-xl bg-secondary/80 border border-border/60 px-4 py-2.5 text-sm font-medium hover:bg-secondary transition">
            <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
          </button>
          <button onClick={() => { setEditing(null); setOpenForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 shadow-[0_0_20px_-4px_oklch(0.65_0.18_240/0.4)]">
            <Plus className="h-4 w-4" /> Novo item
          </button>
        </div>
      </motion.div>

      <Tabs defaultValue="visao-geral" className="space-y-6">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="importacao">Importação (Arquivo)</TabsTrigger>
          <TabsTrigger value="manual">Importação (Copiar/Colar)</TabsTrigger>
        </TabsList>
        
        <TabsContent value="visao-geral" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total de itens", value: String(produtos.length), icon: Package, color: "text-primary" },
          { label: "Alertas de estoque", value: String(alertas.length), icon: AlertTriangle, color: "text-warning" },
          { label: "Valor em estoque", value: fmt(valorEstoque), icon: TrendingUp, color: "text-success" },
          { label: "Itens críticos", value: String(produtos.filter(p => Number(p.quantidade) === 0).length), icon: TrendingDown, color: "text-destructive" },
        ].map((k) => (
          <div key={k.label} className="glass rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
            <div className="flex items-start justify-between relative">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</div>
                <div className="mt-2 text-2xl font-semibold font-display">{k.value}</div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/80 border border-border/60">
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {alertas.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div className="text-sm">
            <span className="font-medium">{alertas.length} item(ns) com estoque baixo:</span>{" "}
            <span className="text-muted-foreground">{alertas.map(a => a.nome).join(", ")}</span>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou código..." className="w-full rounded-xl border border-border bg-secondary/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Categoria</th>
                <th className="px-5 py-3 font-medium text-center">Qtd</th>
                <th className="px-5 py-3 font-medium text-center">Mín</th>
                <th className="px-5 py-3 font-medium">Custo</th>
                <th className="px-5 py-3 font-medium">Venda</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => {
                const baixo = Number(p.quantidade) <= Number(p.qtd_minima);
                return (
                  <tr key={p.id} className="border-b border-border/40 hover:bg-secondary/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium">{p.nome}</div>
                      {p.codigo && <div className="text-xs text-muted-foreground font-mono">{p.codigo}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{p.categoria ?? "—"}</td>
                    <td className="px-5 py-3.5 text-center font-semibold">{Number(p.quantidade)}</td>
                    <td className="px-5 py-3.5 text-center text-muted-foreground">{Number(p.qtd_minima)}</td>
                    <td className="px-5 py-3.5">{fmt(Number(p.preco_custo))}</td>
                    <td className="px-5 py-3.5 font-medium">{fmt(Number(p.preco_venda))}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        baixo ? "bg-warning/15 text-warning" : "bg-success/15 text-success")}>
                        {baixo ? "Estoque baixo" : "OK"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => setMovItem(p)} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-primary/20 text-primary" title="Movimentar">
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditing(p)} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-primary/20" title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { if (confirm(`Remover "${p.nome}"?`)) mDelete.mutate(p.id); }} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/20 text-destructive" title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="p-10 text-center text-muted-foreground text-sm">Carregando…</div>}
        {!isLoading && produtos.length === 0 && <div className="p-10 text-center text-muted-foreground text-sm">Nenhum item cadastrado.</div>}
      </div>
      </TabsContent>

      <TabsContent value="importacao" className="mt-0">
        <Importador onImportDone={() => { invalidate(); document.querySelector<HTMLButtonElement>('[data-value="visao-geral"]')?.click(); }} mode="file" />
      </TabsContent>

      <TabsContent value="manual" className="mt-0">
        <Importador onImportDone={() => { invalidate(); document.querySelector<HTMLButtonElement>('[data-value="visao-geral"]')?.click(); }} mode="manual" />
      </TabsContent>
      </Tabs>

      <ItemDialog open={openForm || !!editing} onOpenChange={(v) => { if (!v) { setOpenForm(false); setEditing(null); } }}
        initial={editing} loading={mCreate.isPending || mUpdate.isPending}
        onSubmit={(d) => {
          const payload: any = {
            nome: d.nome, codigo: d.codigo, categoria: d.categoria, unidade: d.unidade,
            quantidade: Number(d.quantidade || 0), qtd_minima: Number(d.qtd_minima || 0),
            preco_custo: Number(d.preco_custo || 0), preco_venda: Number(d.preco_venda || 0),
            fornecedor: d.fornecedor, observacoes: d.observacoes,
          };
          if (editing) mUpdate.mutate({ ...payload, id: editing.id });
          else mCreate.mutate(payload);
        }} />

      <MovDialog item={movItem} onOpenChange={(v) => !v && setMovItem(null)} loading={mMov.isPending}
        onSubmit={(d) => mMov.mutate({ item_id: movItem!.id, ...d })} />
    </div>
  );
}

function ItemDialog({ open, onOpenChange, initial, onSubmit, loading }: {
  open: boolean; onOpenChange: (v: boolean) => void; initial: Item | null;
  onSubmit: (d: FormData) => void; loading: boolean;
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
    values: initial ? {
      nome: initial.nome, codigo: initial.codigo ?? "", categoria: initial.categoria ?? "",
      unidade: initial.unidade ?? "", quantidade: String(initial.quantidade), qtd_minima: String(initial.qtd_minima),
      preco_custo: String(initial.preco_custo), preco_venda: String(initial.preco_venda),
      fornecedor: initial.fornecedor ?? "", observacoes: "",
    } : { nome: "", codigo: "", categoria: "", unidade: "un", quantidade: "0", qtd_minima: "0", preco_custo: "0", preco_venda: "0", fornecedor: "", observacoes: "" },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{initial ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" {...register("nome")} />
            {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome.message}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label htmlFor="codigo">Código</Label><Input id="codigo" {...register("codigo")} /></div>
            <div><Label htmlFor="categoria">Categoria</Label><Input id="categoria" {...register("categoria")} /></div>
            <div><Label htmlFor="unidade">Unidade</Label><Input id="unidade" {...register("unidade")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="quantidade">Quantidade</Label><Input id="quantidade" type="number" step="0.01" {...register("quantidade")} /></div>
            <div><Label htmlFor="qtd_minima">Mínimo</Label><Input id="qtd_minima" type="number" step="0.01" {...register("qtd_minima")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="preco_custo">Preço de custo</Label><Input id="preco_custo" type="number" step="0.01" {...register("preco_custo")} /></div>
            <div><Label htmlFor="preco_venda">Preço de venda</Label><Input id="preco_venda" type="number" step="0.01" {...register("preco_venda")} /></div>
          </div>
          <div><Label htmlFor="fornecedor">Fornecedor</Label><Input id="fornecedor" {...register("fornecedor")} /></div>
          <div><Label htmlFor="observacoes">Observações</Label><Textarea id="observacoes" rows={2} {...register("observacoes")} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MovDialog({ item, onOpenChange, onSubmit, loading }: {
  item: Item | null; onOpenChange: (v: boolean) => void;
  onSubmit: (d: { tipo: "entrada" | "saida" | "ajuste"; quantidade: number; motivo?: string }) => void; loading: boolean;
}) {
  const [tipo, setTipo] = useState<"entrada" | "saida" | "ajuste">("entrada");
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState("");
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Movimentar — {item?.nome}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (!qtd) return; onSubmit({ tipo, quantidade: Number(qtd), motivo: motivo || undefined }); }} className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
              <option value="ajuste">Ajuste (define qtd)</option>
            </select>
          </div>
          <div><Label>Quantidade</Label><Input type="number" step="0.01" value={qtd} onChange={(e) => setQtd(e.target.value)} required /></div>
          <div><Label>Motivo</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="opcional" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando…" : "Registrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ERP_TEMPLATES: Record<string, Record<string, string>> = {
  Bling: { "Código": "codigo", "Descrição": "nome", "Unidade": "unidade", "Preço": "preco_venda", "Preço de Custo": "preco_custo", "Estoque": "quantidade", "Categoria": "categoria" },
  ContaAzul: { "Código do Item": "codigo", "Nome do Item": "nome", "Unidade de Medida": "unidade", "Valor de Venda": "preco_venda", "Custo": "preco_custo", "Quantidade em Estoque": "quantidade", "Categoria do Item": "categoria" },
  Tiny: { "Código SKU": "codigo", "Nome": "nome", "Unidade": "unidade", "Preço Venda": "preco_venda", "Preço Custo": "preco_custo", "Saldo": "quantidade", "Categoria": "categoria" },
  MarketUP: { "Código Interno": "codigo", "Descrição do Item": "nome", "Unidade": "unidade", "Preço Venda": "preco_venda", "Preço Custo": "preco_custo", "Estoque Atual": "quantidade", "Subcategoria": "categoria" }
};

function Importador({ onImportDone, mode }: { onImportDone: () => void, mode: "file" | "manual" }) {
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [rawData, setRawData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [erpTemplate, setErpTemplate] = useState<string>("auto");
  
  const bImport = useServerFn(bulkImportEstoque);
  const mBulk = useMutation({
    mutationFn: (d: any[]) => bImport({ data: d }),
    onSuccess: () => { 
      toast.success("Importação concluída com sucesso!"); 
      onImportDone();
      setFile(null);
      setRawText("");
      setRawData([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sysFields = [
    { key: "nome", label: "Nome do Produto" },
    { key: "codigo", label: "Código / SKU" },
    { key: "categoria", label: "Categoria" },
    { key: "quantidade", label: "Estoque Atual" },
    { key: "preco_custo", label: "Preço de Custo" },
    { key: "preco_venda", label: "Preço de Venda" },
    { key: "fornecedor", label: "Fornecedor" },
    { key: "unidade", label: "Unidade (un, kg, l)" }
  ];

  const applyMapping = (cols: string[], template: string) => {
    setErpTemplate(template);
    const newMapping: Record<string, string> = {};
    if (template === "auto") {
      const normalized = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      cols.forEach(col => {
        const norm = normalized(col);
        if (norm.includes("nome") || norm.includes("produto") || norm.includes("descricao")) newMapping[col] = "nome";
        else if (norm.includes("cod") || norm.includes("sku")) newMapping[col] = "codigo";
        else if (norm.includes("cat") || norm.includes("grupo")) newMapping[col] = "categoria";
        else if (norm.includes("qtd") || norm.includes("quant") || norm.includes("estoque") || norm.includes("saldo")) newMapping[col] = "quantidade";
        else if (norm.includes("custo")) newMapping[col] = "preco_custo";
        else if (norm.includes("venda") || norm.includes("preco") || norm.includes("valor")) newMapping[col] = "preco_venda";
        else if (norm.includes("fornec")) newMapping[col] = "fornecedor";
        else if (norm.includes("unid")) newMapping[col] = "unidade";
      });
    } else {
      const tpl = ERP_TEMPLATES[template];
      if (tpl) {
        cols.forEach(col => {
          if (tpl[col]) newMapping[col] = tpl[col];
        });
      }
    }
    setMapping(newMapping);
  };

  const processParsed = (results: Papa.ParseResult<any>) => {
    if (!results.meta.fields) {
      toast.error("Não foi possível ler as colunas. Verifique o formato do arquivo ou texto.");
      return;
    }
    setColumns(results.meta.fields);
    setRawData(results.data);
    applyMapping(results.meta.fields, "auto");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    
    if (f.name.endsWith(".csv")) {
      Papa.parse(f, { header: true, skipEmptyLines: true, complete: processParsed });
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        import("xlsx").then((XLSX) => {
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
          if (data.length === 0) {
            toast.error("Planilha vazia ou em formato inválido.");
            return;
          }
          const headers = Object.keys(data[0] as any);
          setColumns(headers);
          setRawData(data);
          applyMapping(headers, "auto");
        });
      };
      reader.readAsBinaryString(f);
    }
  };

  const handleTextParse = () => {
    if (!rawText.trim()) return;
    Papa.parse(rawText.trim(), { header: true, skipEmptyLines: true, complete: processParsed });
  };

  const executeImport = () => {
    if (!Object.values(mapping).includes("nome")) {
      toast.error("O campo 'Nome do Produto' é obrigatório no mapeamento.");
      return;
    }
    
    const parseNumber = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      const numStr = String(val).replace(/[^0-9,-]/g, "").replace(",", ".");
      return Number(numStr) || 0;
    };

    const payload = rawData.map(row => {
      const item: any = { nome: "", quantidade: 0, preco_custo: 0, preco_venda: 0 };
      Object.entries(mapping).forEach(([csvCol, sysKey]) => {
        if (!sysKey || !row[csvCol]) return;
        const val = row[csvCol];
        if (["quantidade", "preco_custo", "preco_venda"].includes(sysKey)) {
          item[sysKey] = parseNumber(val);
        } else {
          item[sysKey] = String(val).trim();
        }
      });
      return item;
    }).filter(item => item.nome);

    mBulk.mutate(payload);
  };

  if (rawData.length === 0) {
    if (mode === "file") {
      return (
        <div className="glass rounded-2xl p-10 flex flex-col items-center justify-center text-center border border-dashed border-primary/30">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Importação via Arquivo (.xlsx, .csv)</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
            Faça upload do arquivo gerado pelo seu ERP antigo. Mapearemos as colunas automaticamente.
          </p>
          <Button onClick={() => document.getElementById("file-upload")?.click()}>Selecionar Arquivo</Button>
          <input id="file-upload" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
        </div>
      );
    } else {
      return (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-2">Importação Manual (Copiar e Colar)</h3>
          <p className="text-sm text-muted-foreground mb-4">Copie os dados do seu Excel, Sheets ou Bloco de Notas e cole aqui.</p>
          <Textarea 
             className="min-h-[250px] font-mono text-xs mb-4 bg-secondary/30" 
             placeholder="Cole aqui... (ex:&#10;Nome do Produto &#9; Preço Venda &#9; Estoque&#10;Óleo Motul 10W40 &#9; 89,90 &#9; 12)"
             value={rawText}
             onChange={e => setRawText(e.target.value)}
          />
          <Button onClick={handleTextParse}>Analisar Tabela</Button>
        </div>
      );
    }
  }

  const validCount = rawData.filter(r => {
     const nomeCol = Object.keys(mapping).find(k => mapping[k] === "nome");
     return nomeCol && r[nomeCol]?.trim();
  }).length;

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{mode === "file" ? file?.name : "Dados Colados"}</h3>
            <p className="text-sm text-muted-foreground">{rawData.length} linhas ({validCount} válidas para importar)</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
             value={erpTemplate} 
             onChange={e => applyMapping(columns, e.target.value)}
             className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="auto">Mapeamento Inteligente (Genérico)</option>
            {Object.keys(ERP_TEMPLATES).map(k => <option key={k} value={k}>Padrão {k}</option>)}
          </select>
          
          <Button variant="outline" onClick={() => { setFile(null); setRawText(""); setRawData([]); }} className="hidden md:flex">Cancelar</Button>
          <Button onClick={executeImport} disabled={mBulk.isPending} className="gap-2 hidden md:flex bg-success hover:bg-success/90 text-success-foreground">
            <Check className="h-4 w-4" /> {mBulk.isPending ? "Salvando..." : "Salvar no Estoque"}
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-medium mb-4">Mapeamento e Pré-visualização</h3>
        
        <div className="overflow-x-auto border border-border/50 rounded-xl mb-6">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50">
              <tr>
                {columns.map(col => (
                  <th key={col} className="p-3 font-medium min-w-[150px]">
                    <div className="mb-2 text-muted-foreground">{col}</div>
                    <select 
                      value={mapping[col] || ""} 
                      onChange={e => setMapping(prev => ({...prev, [col]: e.target.value}))}
                      className="w-full rounded bg-background border border-border px-2 py-1 text-xs"
                    >
                      <option value="">(Ignorar coluna)</option>
                      {sysFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rawData.slice(0, 3).map((row, i) => (
                <tr key={i} className="hover:bg-secondary/20">
                  {columns.map(col => (
                    <td key={col} className="p-3 text-xs truncate max-w-[200px]">{row[col]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex items-center justify-end gap-4 mt-6 pt-6 border-t border-border/50">
          <div className="text-sm text-muted-foreground mr-auto hidden sm:block">
            Revise as colunas e clique em salvar para inserir os {validCount} produtos.
          </div>
          <Button variant="outline" onClick={() => { setFile(null); setRawText(""); setRawData([]); }}>
            Cancelar Importação
          </Button>
          <Button onClick={executeImport} disabled={mBulk.isPending || validCount === 0} size="lg" className="gap-2 bg-success hover:bg-success/90 text-success-foreground shadow-[0_0_20px_-4px_var(--color-success)]">
            <Check className="h-5 w-5" /> 
            {mBulk.isPending ? "Salvando..." : "Salvar no Estoque"}
          </Button>
        </div>
      </div>
    </div>
  );
}