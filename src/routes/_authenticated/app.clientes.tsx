import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Users, Search, Plus, Phone, Mail, Pencil, Trash2, Upload, FileSpreadsheet, Check } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Papa from "papaparse";
import {
  listClientes, createCliente, updateCliente, deleteCliente, bulkImportClientes
} from "@/lib/clientes.functions";

export const Route = createFileRoute("/_authenticated/app/clientes")({ component: Page });

const Schema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(120),
  telefone: z.string().trim().max(30).optional(),
  email: z.string().trim().email("Email inválido").max(160).optional().or(z.literal("")),
  documento: z.string().trim().max(30).optional(),
  endereco: z.string().trim().max(255).optional(),
  cidade: z.string().trim().max(80).optional(),
  estado: z.string().trim().max(40).optional(),
  cep: z.string().trim().max(15).optional(),
  observacoes: z.string().trim().max(1000).optional(),
});
type FormData = z.infer<typeof Schema>;
type Cliente = { id: string; nome: string; telefone: string | null; email: string | null; documento: string | null; cidade: string | null; estado: string | null };

function Page() {
  const [busca, setBusca] = useState("");
  const [tab, setTab] = useState("visao-geral");
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const list = useServerFn(listClientes);
  const create = useServerFn(createCliente);
  const update = useServerFn(updateCliente);
  const remove = useServerFn(deleteCliente);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => list(),
  });

  const mCreate = useMutation({
    mutationFn: (d: FormData) => create({ data: d as any }),
    onSuccess: () => { toast.success("Cliente criado"); qc.invalidateQueries({ queryKey: ["clientes"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mUpdate = useMutation({
    mutationFn: (d: FormData & { id: string }) => update({ data: d as any }),
    onSuccess: () => { toast.success("Cliente atualizado"); qc.invalidateQueries({ queryKey: ["clientes"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Cliente excluído"); qc.invalidateQueries({ queryKey: ["clientes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (clientes as Cliente[]).filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (c.telefone ?? "").includes(busca),
  );

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(c: Cliente) { setEditing(c); setOpen(true); }
  function handleDelete(c: Cliente) {
    if (confirm(`Excluir "${c.nome}"? Esta ação não pode ser desfeita.`)) mDelete.mutate(c.id);
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <Users className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">Cadastro e CRM de clientes da oficina.</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 shadow-[0_0_20px_-4px_oklch(0.65_0.18_240/0.4)]">
          <Plus className="h-4 w-4" /> Novo cliente
        </button>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="importacao">Importação Inteligente</TabsTrigger>
          <TabsTrigger value="manual">Importar Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone..." className="w-full rounded-xl border border-border bg-secondary/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground" />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Contato</th>
                <th className="px-5 py-3 font-medium">Documento</th>
                <th className="px-5 py-3 font-medium">Cidade</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-border/40 hover:bg-secondary/40 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                        {c.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </div>
                      <span className="font-medium">{c.nome}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="space-y-0.5">
                      {c.telefone && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" /> {c.telefone}</div>}
                      {c.email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3" /> {c.email}</div>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">{c.documento ?? "—"}</td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">{c.cidade ? `${c.cidade}${c.estado ? "/" + c.estado : ""}` : "—"}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(c)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary transition" title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(c)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-destructive/20 text-destructive transition" title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="p-10 text-center text-muted-foreground text-sm">Carregando…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-10 text-center text-muted-foreground text-sm">Nenhum cliente cadastrado.</div>
        )}
      </motion.div>
      </TabsContent>

      <TabsContent value="importacao" className="mt-0">
        <ImportadorClientes onImportDone={() => { qc.invalidateQueries({ queryKey: ["clientes"] }); setTab("visao-geral"); }} mode="file" />
      </TabsContent>

      <TabsContent value="manual" className="mt-0">
        <ImportadorClientes onImportDone={() => { qc.invalidateQueries({ queryKey: ["clientes"] }); setTab("visao-geral"); }} mode="manual" />
      </TabsContent>
      </Tabs>

      <ClienteDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        editing={editing}
        onSubmit={(d) => editing ? mUpdate.mutate({ ...d, id: editing.id }) : mCreate.mutate(d)}
        loading={mCreate.isPending || mUpdate.isPending}
      />
    </div>
  );
}

function ClienteDialog({ open, onOpenChange, editing, onSubmit, loading }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Cliente | null;
  onSubmit: (d: FormData) => void;
  loading: boolean;
}) {
  const form = useForm<FormData>({
    resolver: zodResolver(Schema),
    values: {
      nome: editing?.nome ?? "",
      telefone: editing?.telefone ?? "",
      email: editing?.email ?? "",
      documento: editing?.documento ?? "",
      endereco: "",
      cidade: editing?.cidade ?? "",
      estado: editing?.estado ?? "",
      cep: "",
      observacoes: "",
    },
  });
  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => onSubmit(d))} className="space-y-3">
          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" {...register("nome")} />
            {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" {...register("telefone")} />
            </div>
            <div>
              <Label htmlFor="documento">CPF/CNPJ</Label>
              <Input id="documento" {...register("documento")} />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" {...register("endereco")} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" {...register("cidade")} />
            </div>
            <div>
              <Label htmlFor="estado">UF</Label>
              <Input id="estado" {...register("estado")} maxLength={2} />
            </div>
          </div>
          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" {...register("observacoes")} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportadorClientes({ onImportDone, mode }: { onImportDone: () => void, mode: "file" | "manual" }) {
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [rawData, setRawData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  
  const bImport = useServerFn(bulkImportClientes);
  const mBulk = useMutation({
    mutationFn: (d: any[]) => bImport({ data: d }),
    onSuccess: (result: any) => {
      const totalSalvo = Number(result?.inseridos || 0) + Number(result?.atualizados || 0);
      if (totalSalvo === 0) {
        toast.error("Nenhum cliente foi salvo. Revise o mapeamento e os dados.");
        return;
      }
      toast.success(`Importação concluída: ${result?.inseridos || 0} novos e ${result?.atualizados || 0} atualizados.`);
      onImportDone();
      setFile(null);
      setRawText("");
      setRawData([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sysFields = [
    { key: "nome", label: "Nome do Cliente" },
    { key: "telefone", label: "Telefone / Celular" },
    { key: "email", label: "E-mail" },
    { key: "documento", label: "CPF / CNPJ" },
    { key: "endereco", label: "Endereço Completo" },
    { key: "cidade", label: "Cidade" },
    { key: "estado", label: "Estado (UF)" },
    { key: "cep", label: "CEP" }
  ];

  const applyMapping = (cols: string[]) => {
    const newMapping: Record<string, string> = {};
    const normalized = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    cols.forEach(col => {
      const norm = normalized(col);
      if (norm.includes("nome") || norm.includes("cliente") || norm.includes("razao")) newMapping[col] = "nome";
      else if (norm.includes("tel") || norm.includes("cel") || norm.includes("fone") || norm.includes("whatsapp")) newMapping[col] = "telefone";
      else if (norm.includes("email") || norm.includes("e-mail")) newMapping[col] = "email";
      else if (norm.includes("doc") || norm.includes("cpf") || norm.includes("cnpj")) newMapping[col] = "documento";
      else if (norm.includes("end") || norm.includes("rua") || norm.includes("logradouro")) newMapping[col] = "endereco";
      else if (norm.includes("cid") || norm.includes("municipio")) newMapping[col] = "cidade";
      else if (norm.includes("est") || norm.includes("uf")) newMapping[col] = "estado";
      else if (norm.includes("cep")) newMapping[col] = "cep";
    });
    setMapping(newMapping);
  };

  const processParsed = (results: Papa.ParseResult<any>) => {
    if (!results.meta.fields) {
      toast.error("Não foi possível ler as colunas. Verifique o formato.");
      return;
    }
    setColumns(results.meta.fields);
    setRawData(results.data);
    applyMapping(results.meta.fields);
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
            toast.error("Planilha vazia ou formato inválido.");
            return;
          }
          const headers = Object.keys(data[0] as any);
          setColumns(headers);
          setRawData(data);
          applyMapping(headers);
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
      toast.error("A coluna 'Nome do Cliente' é obrigatória no mapeamento.");
      return;
    }
    
    const payload = rawData.map(row => {
      const item: any = { nome: "" };
      Object.entries(mapping).forEach(([csvCol, sysKey]) => {
        if (!sysKey || !row[csvCol]) return;
        item[sysKey] = String(row[csvCol]).trim();
      });
      return item;
    }).filter(item => item.nome);

    if (payload.length === 0) {
      toast.error("Nenhuma linha válida encontrada para salvar.");
      return;
    }

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
            Faça upload do arquivo da sua agenda ou sistema antigo.
          </p>
          <Button onClick={() => document.getElementById("file-upload")?.click()}>Selecionar Arquivo</Button>
          <input id="file-upload" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
        </div>
      );
    } else {
      return (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-2">Importação Manual (Copiar e Colar)</h3>
          <p className="text-sm text-muted-foreground mb-4">Copie do Excel/Planilha as linhas (com o cabeçalho) e cole aqui.</p>
          <Textarea 
             className="min-h-[250px] font-mono text-xs mb-4 bg-secondary/30" 
             placeholder="Cole aqui... (ex:&#10;Nome &#9; Telefone &#9; Email&#10;João Silva &#9; 1199999999 &#9; joao@email.com)"
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
            <p className="text-sm text-muted-foreground">{rawData.length} linhas ({validCount} válidas)</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => { setFile(null); setRawText(""); setRawData([]); }}>Cancelar</Button>
          <Button onClick={executeImport} disabled={mBulk.isPending} className="gap-2 bg-success hover:bg-success/90 text-success-foreground">
            <Check className="h-4 w-4" /> {mBulk.isPending ? "Salvando..." : "Salvar Clientes"}
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-medium mb-4">Mapeamento das Colunas</h3>
        
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
        
        <div className="flex items-center justify-end">
          <Button onClick={executeImport} disabled={mBulk.isPending || validCount === 0} size="lg" className="gap-2 bg-success hover:bg-success/90 text-success-foreground">
            <Check className="h-5 w-5" /> 
            {mBulk.isPending ? "Salvando..." : "Importar Agora"}
          </Button>
        </div>
      </div>
    </div>
  );
}
