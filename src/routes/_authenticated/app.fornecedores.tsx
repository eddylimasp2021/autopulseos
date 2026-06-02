import { createFileRoute } from '@tanstack/react-router'
import { motion, AnimatePresence } from "framer-motion";
import { Truck, Plus, Search, Edit, Trash2, Phone, Mail, MapPin, Loader2, Upload, FileSpreadsheet, Check, Download } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Papa from "papaparse";

import { listFornecedores, createFornecedor, updateFornecedor, deleteFornecedor, bulkImportFornecedores, FornecedorInputSchema, type FornecedorInput } from "@/lib/fornecedores.functions";

export const Route = createFileRoute("/_authenticated/app/fornecedores")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [tab, setTab] = useState("visao-geral");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Server functions
  const listFn = useServerFn(listFornecedores);
  const createFn = useServerFn(createFornecedor);
  const updateFn = useServerFn(updateFornecedor);
  const deleteFn = useServerFn(deleteFornecedor);

  // Queries
  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: () => listFn(),
  });

  // Mutations
  const mCreate = useMutation({
    mutationFn: (d: FornecedorInput) => createFn({ data: d }),
    onSuccess: () => {
      toast.success("Fornecedor cadastrado com sucesso!");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mUpdate = useMutation({
    mutationFn: (d: FornecedorInput) => updateFn({ data: d }),
    onSuccess: () => {
      toast.success("Fornecedor atualizado!");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Fornecedor excluído!");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return fornecedores;
    return fornecedores.filter(
      (f: any) =>
        f.nome_fantasia?.toLowerCase().includes(q) ||
        f.razao_social?.toLowerCase().includes(q) ||
        f.cnpj_cpf?.includes(q)
    );
  }, [fornecedores, searchTerm]);

  // Form
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FornecedorInput>({
    resolver: zodResolver(FornecedorInputSchema),
    defaultValues: { status: "ativo" }
  });

  const openDialogForNew = () => {
    reset({ status: "ativo" });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openDialogForEdit = (f: any) => {
    reset({
      id: f.id,
      nome_fantasia: f.nome_fantasia,
      razao_social: f.razao_social || "",
      cnpj_cpf: f.cnpj_cpf || "",
      inscricao_estadual: f.inscricao_estadual || "",
      email: f.email || "",
      telefone: f.telefone || "",
      celular: f.celular || "",
      cep: f.cep || "",
      endereco: f.endereco || "",
      numero: f.numero || "",
      bairro: f.bairro || "",
      cidade: f.cidade || "",
      estado: f.estado || "",
      observacoes: f.observacoes || "",
      status: f.status || "ativo",
    });
    setEditingId(f.id);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    reset();
  };

  const onSubmit = (data: FornecedorInput) => {
    if (editingId) {
      mUpdate.mutate({ ...data, id: editingId });
    } else {
      mCreate.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita.")) {
      mDelete.mutate(id);
    }
  };

  const handleExport = () => {
    if (fornecedores.length === 0) {
      toast.info("Nenhum fornecedor para exportar.");
      return;
    }
    const csvData = fornecedores.map((f: any) => ({
      NomeFantasia: f.nome_fantasia || "",
      RazaoSocial: f.razao_social || "",
      CNPJ_CPF: f.cnpj_cpf || "",
      InscricaoEstadual: f.inscricao_estadual || "",
      Email: f.email || "",
      Celular: f.celular || "",
      Telefone: f.telefone || "",
      CEP: f.cep || "",
      Endereco: f.endereco || "",
      Numero: f.numero || "",
      Bairro: f.bairro || "",
      Cidade: f.cidade || "",
      Estado: f.estado || "",
      Status: f.status || "",
      Observacoes: f.observacoes || "",
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `fornecedores_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exportação concluída!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <Truck className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Fornecedores</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie fornecedores, importação e exportação de dados.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button onClick={openDialogForNew} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Novo Fornecedor
          </Button>
        </div>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="importacao">Importar Planilha</TabsTrigger>
          <TabsTrigger value="manual">Importar Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6 mt-0">
          {/* Toolbar */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, razão social ou CNPJ/CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 bg-background/50 backdrop-blur-sm border-border/60"
              />
            </div>
          </motion.div>

          {/* List */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            {isLoading ? (
              <div className="p-12 text-center flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Carregando fornecedores...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center glass rounded-2xl border border-border/50">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium">Nenhum fornecedor encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">Tente ajustar sua busca ou cadastre um novo fornecedor.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {filtered.map((f: any) => (
                    <motion.div
                      key={f.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="glass p-5 rounded-2xl border border-border/50 flex flex-col hover:border-primary/30 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold text-lg line-clamp-1" title={f.nome_fantasia}>{f.nome_fantasia}</h3>
                          {f.cnpj_cpf && <p className="text-xs text-muted-foreground mt-0.5">{f.cnpj_cpf}</p>}
                        </div>
                        <div className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold border ${
                          f.status === 'ativo' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}>
                          {f.status}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground flex-1">
                        {f.telefone || f.celular ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" /> <span>{f.celular || f.telefone}</span>
                          </div>
                        ) : null}
                        {f.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" /> <span className="truncate">{f.email}</span>
                          </div>
                        )}
                        {f.cidade && f.estado && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" /> <span className="truncate">{f.cidade} - {f.estado}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-4 mt-4 border-t border-border/40 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openDialogForEdit(f)} className="h-8 px-2 text-primary hover:bg-primary/10">
                          <Edit className="h-4 w-4 mr-1.5" /> Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(f.id)} className="h-8 px-2 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="importacao" className="mt-0">
          <ImportadorFornecedores onImportDone={() => { qc.invalidateQueries({ queryKey: ["fornecedores"] }); setTab("visao-geral"); }} mode="file" />
        </TabsContent>

        <TabsContent value="manual" className="mt-0">
          <ImportadorFornecedores onImportDone={() => { qc.invalidateQueries({ queryKey: ["fornecedores"] }); setTab("visao-geral"); }} mode="manual" />
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome_fantasia">Nome Fantasia *</Label>
                <Input id="nome_fantasia" {...register("nome_fantasia")} />
                {errors.nome_fantasia && <p className="text-xs text-destructive">{errors.nome_fantasia.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="razao_social">Razão Social</Label>
                <Input id="razao_social" {...register("razao_social")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj_cpf">CNPJ / CPF</Label>
                <Input id="cnpj_cpf" {...register("cnpj_cpf")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                <Input id="inscricao_estadual" {...register("inscricao_estadual")} />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold mb-4 flex items-center gap-2"><Phone className="h-4 w-4"/> Contato</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" {...register("email")} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="celular">Celular / WhatsApp</Label>
                  <Input id="celular" {...register("celular")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone Fixo</Label>
                  <Input id="telefone" {...register("telefone")} />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold mb-4 flex items-center gap-2"><MapPin className="h-4 w-4"/> Endereço</h4>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="cep">CEP</Label>
                  <Input id="cep" {...register("cep")} />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="endereco">Endereço (Rua, Av, etc)</Label>
                  <Input id="endereco" {...register("endereco")} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="numero">Número</Label>
                  <Input id="numero" {...register("numero")} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input id="bairro" {...register("bairro")} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" {...register("cidade")} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="estado">Estado (UF)</Label>
                  <Input id="estado" {...register("estado")} maxLength={2} />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    {...register("status")}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea id="observacoes" {...register("observacoes")} rows={3} placeholder="Anotações internas..." />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mCreate.isPending || mUpdate.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {(mCreate.isPending || mUpdate.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Fornecedor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImportadorFornecedores({ onImportDone, mode }: { onImportDone: () => void, mode: "file" | "manual" }) {
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [rawData, setRawData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  
  const bImport = useServerFn(bulkImportFornecedores);
  const mBulk = useMutation({
    mutationFn: (d: any[]) => bImport({ data: d }),
    onSuccess: (result: any) => {
      const totalSalvo = Number(result?.inseridos || 0) + Number(result?.atualizados || 0);
      if (totalSalvo === 0) {
        toast.error("Nenhum fornecedor foi salvo. Revise o mapeamento e os dados.");
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
    { key: "nome_fantasia", label: "Nome Fantasia" },
    { key: "razao_social", label: "Razão Social" },
    { key: "cnpj_cpf", label: "CPF / CNPJ" },
    { key: "inscricao_estadual", label: "Inscrição Estadual" },
    { key: "celular", label: "Celular / WhatsApp" },
    { key: "telefone", label: "Telefone" },
    { key: "email", label: "E-mail" },
    { key: "endereco", label: "Endereço Completo" },
    { key: "numero", label: "Número" },
    { key: "bairro", label: "Bairro" },
    { key: "cidade", label: "Cidade" },
    { key: "estado", label: "Estado (UF)" },
    { key: "cep", label: "CEP" },
    { key: "observacoes", label: "Observações" }
  ];

  const applyMapping = (cols: string[]) => {
    const newMapping: Record<string, string> = {};
    const normalized = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    cols.forEach(col => {
      const norm = normalized(col);
      if (norm.includes("fantasia") || norm.includes("nome")) newMapping[col] = "nome_fantasia";
      else if (norm.includes("razao")) newMapping[col] = "razao_social";
      else if (norm.includes("doc") || norm.includes("cpf") || norm.includes("cnpj")) newMapping[col] = "cnpj_cpf";
      else if (norm.includes("ie") || norm.includes("inscricao")) newMapping[col] = "inscricao_estadual";
      else if (norm.includes("cel") || norm.includes("whatsapp")) newMapping[col] = "celular";
      else if (norm.includes("tel") || norm.includes("fone")) newMapping[col] = "telefone";
      else if (norm.includes("email") || norm.includes("e-mail")) newMapping[col] = "email";
      else if (norm.includes("end") || norm.includes("rua") || norm.includes("logradouro")) newMapping[col] = "endereco";
      else if (norm.includes("num") || norm === "n" || norm === "no") newMapping[col] = "numero";
      else if (norm.includes("bairro")) newMapping[col] = "bairro";
      else if (norm.includes("cid") || norm.includes("municipio")) newMapping[col] = "cidade";
      else if (norm.includes("est") || norm.includes("uf")) newMapping[col] = "estado";
      else if (norm.includes("cep")) newMapping[col] = "cep";
      else if (norm.includes("obs")) newMapping[col] = "observacoes";
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
    if (!Object.values(mapping).includes("nome_fantasia")) {
      toast.error("A coluna 'Nome Fantasia' é obrigatória no mapeamento.");
      return;
    }
    
    const payload = rawData.map(row => {
      const item: any = { nome_fantasia: "", status: "ativo" };
      Object.entries(mapping).forEach(([csvCol, sysKey]) => {
        if (!sysKey || !row[csvCol]) return;
        item[sysKey] = String(row[csvCol]).trim();
      });
      return item;
    }).filter(item => item.nome_fantasia);

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
            Faça upload do arquivo dos seus fornecedores.
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
             placeholder="Cole aqui... (ex:&#10;Nome Fantasia &#9; Telefone &#9; Email&#10;Fornecedor X &#9; 1199999999 &#9; email@fornecedor.com)"
             value={rawText}
             onChange={e => setRawText(e.target.value)}
          />
          <Button onClick={handleTextParse}>Analisar Tabela</Button>
        </div>
      );
    }
  }

  const validCount = rawData.filter(r => {
     const nomeCol = Object.keys(mapping).find(k => mapping[k] === "nome_fantasia");
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
            <Check className="h-4 w-4" /> {mBulk.isPending ? "Salvando..." : "Salvar Fornecedores"}
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
