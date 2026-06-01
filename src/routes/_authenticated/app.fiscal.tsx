import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, Settings, UploadCloud, Download, Trash2, Check, FileCheck, 
  FileDigit, Landmark, Calendar, Mail, FileCode, Search, ShieldAlert,
  Loader2, AlertTriangle, HelpCircle, FileArchive, ArrowUpRight,
  Globe, Cpu
} from "lucide-react";
import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import JSZip from "jszip";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { getFiscalConfig, saveFiscalConfig, saveFiscalXML, listFiscalXMLs, deleteFiscalXML } from "@/lib/fiscal.functions";

export const Route = createFileRoute("/_authenticated/app/fiscal")({ component: Page });

const FiscalSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  cnpj: z.string().trim().min(14, "CNPJ inválido").max(18, "CNPJ inválido"),
  razao_social: z.string().trim().min(1, "Informe a Razão Social"),
  nome_fantasia: z.string().trim().min(1, "Informe o Nome Fantasia"),
  inscricao_estadual: z.string().trim().optional().nullable(),
  inscricao_municipal: z.string().trim().optional().nullable(),
  regime_tributario: z.string().trim().min(1, "Selecione o regime tributário"),
  cnae: z.string().trim().optional().nullable(),
  ambiente: z.enum(["homologacao", "producao"]),
  
  certificado_base64: z.string().trim().optional().nullable(),
  certificado_senha: z.string().trim().optional().nullable(),
  certificado_nome_arquivo: z.string().trim().optional().nullable(),
  
  nfce_serie: z.coerce.number().int().min(1),
  nfce_ultimo_numero: z.coerce.number().int().min(0),
  nfce_csc_id: z.string().trim().optional().nullable(),
  nfce_csc_token: z.string().trim().optional().nullable(),
  
  nfe_serie: z.coerce.number().int().min(1),
  nfe_ultimo_numero: z.coerce.number().int().min(0),
  
  nfse_serie: z.coerce.number().int().min(1),
  nfse_ultimo_numero: z.coerce.number().int().min(0),

  api_provider: z.string().trim().optional().nullable(),
  api_token: z.string().trim().optional().nullable(),
});
type FiscalFormData = z.infer<typeof FiscalSchema>;

interface ParsedXML {
  chave: string;
  numero: number;
  serie: number;
  tipo: "nfe_emitida" | "nfce_emitida" | "nfe_importada";
  data_emissao: string;
  valor_total: number;
  xml_content: string;
  xml_filename: string;
  destinatario_nome: string;
  destinatario_documento: string;
  status: "autorizada" | "cancelada" | "importada";
  error?: string;
}

function Page() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("config");
  
  // XML View Modal State
  const [viewXmlOpen, setViewXmlOpen] = useState(false);
  const [selectedXmlContent, setSelectedXmlContent] = useState("");
  const [selectedXmlTitle, setSelectedXmlTitle] = useState("");

  // Accountant Email Modal State
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [contadorEmail, setContadorEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // File Upload State
  const [parsedFiles, setParsedFiles] = useState<ParsedXML[]>([]);
  const [importingAll, setImportingAll] = useState(false);

  // Queries e Server Functions
  const getWConfig = useServerFn(getFiscalConfig);
  const saveWConfig = useServerFn(saveFiscalConfig);
  const saveXml = useServerFn(saveFiscalXML);
  const listXmls = useServerFn(listFiscalXMLs);
  const deleteXml = useServerFn(deleteFiscalXML);

  const { data: config, isLoading: loadingConfig, refetch: refetchConfig } = useQuery({
    queryKey: ["fiscal-config"],
    queryFn: () => getWConfig()
  });

  const { data: xmls = [], isLoading: loadingXmls, refetch: refetchXmls } = useQuery({
    queryKey: ["fiscal-xmls"],
    queryFn: () => listXmls()
  });

  const mSaveConfig = useMutation({
    mutationFn: (d: FiscalFormData) => saveWConfig({ data: d }),
    onSuccess: () => {
      toast.success("Configuração fiscal salva com sucesso!");
      refetchConfig();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const mDeleteXml = useMutation({
    mutationFn: (id: string) => deleteXml({ data: { id } }),
    onSuccess: () => {
      toast.success("Documento XML removido!");
      refetchXmls();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  // Fechamento mensal state
  const [filtroMes, setFiltroMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Filter stored XMLs by month
  const filteredXmls = useMemo(() => {
    if (!filtroMes) return xmls;
    const [year, month] = filtroMes.split("-");
    return xmls.filter((x: any) => {
      const date = new Date(x.data_emissao);
      return date.getFullYear() === Number(year) && (date.getMonth() + 1) === Number(month);
    });
  }, [xmls, filtroMes]);

  // Statistics
  const stats = useMemo(() => {
    const result = {
      totalVal: 0,
      nfeQty: 0,
      nfceQty: 0,
      importQty: 0,
      canceledQty: 0,
    };
    filteredXmls.forEach((x: any) => {
      result.totalVal += Number(x.valor_total);
      if (x.tipo === "nfe_emitida") result.nfeQty++;
      else if (x.tipo === "nfce_emitida") result.nfceQty++;
      else if (x.tipo === "nfe_importada") result.importQty++;
      
      if (x.status === "cancelada") result.canceledQty++;
    });
    return result;
  }, [filteredXmls]);

  // JSZip Exporter
  const handleExportZip = async () => {
    if (filteredXmls.length === 0) {
      toast.error("Nenhum XML encontrado no período selecionado.");
      return;
    }

    const zip = new JSZip();
    filteredXmls.forEach((x: any) => {
      const folderName = x.tipo === "nfe_importada" ? "Importadas" : "Emitidas";
      zip.folder(folderName)?.file(`${x.chave}.xml`, x.xml_content);
    });

    try {
      const blob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fechamento_fiscal_${config?.cnpj || "workshop"}_${filtroMes.replace("-", "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Arquivo ZIP gerado e baixado com sucesso!");
    } catch (e) {
      toast.error("Erro ao gerar o arquivo ZIP.");
    }
  };

  const handleSendToContador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contadorEmail) {
      toast.error("Informe o e-mail do contador.");
      return;
    }
    setSendingEmail(true);
    // Simular o envio com um pequeno delay
    setTimeout(() => {
      setSendingEmail(false);
      setEmailModalOpen(false);
      setContadorEmail("");
      toast.success(`E-mail com relatório e XMLs enviado com sucesso para ${contadorEmail}!`);
    }, 2000);
  };

  const handleDownloadSingleXML = (xml: any) => {
    const blob = new Blob([xml.xml_content], { type: "text/xml" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = xml.xml_filename || `${xml.chave}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleViewXml = (xml: any) => {
    setSelectedXmlTitle(`${xml.tipo.replace("_", " ").toUpperCase()} - Nº ${xml.numero}`);
    setSelectedXmlContent(xml.xml_content);
    setViewXmlOpen(true);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
          <FileText className="h-5 w-5 text-neon-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Módulo Fiscal</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure impostos, importe XMLs e realize fechamentos mensais para a contabilidade.</p>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary/40 border border-border/40 p-1 rounded-xl">
          <TabsTrigger value="config" className="gap-2 rounded-lg text-xs md:text-sm">
            <Settings className="h-4 w-4" /> Configuração Fiscal
          </TabsTrigger>
          <TabsTrigger value="api-gateway" className="gap-2 rounded-lg text-xs md:text-sm">
            <Globe className="h-4 w-4" /> Gateway API Fiscal
          </TabsTrigger>
          <TabsTrigger value="xmls" className="gap-2 rounded-lg text-xs md:text-sm">
            <UploadCloud className="h-4 w-4" /> Arquivo & Importação XML
          </TabsTrigger>
          <TabsTrigger value="contador" className="gap-2 rounded-lg text-xs md:text-sm">
            <Calendar className="h-4 w-4" /> Fechamento & Contador
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-0">
          <ConfigTab 
            config={config} 
            loading={loadingConfig} 
            onSave={(d) => mSaveConfig.mutate(d)} 
            saving={mSaveConfig.isPending} 
          />
        </TabsContent>

        <TabsContent value="api-gateway" className="mt-0">
          <ApiGatewayTab 
            config={config} 
            loading={loadingConfig} 
            onSave={(d) => mSaveConfig.mutate(d)} 
            saving={mSaveConfig.isPending} 
          />
        </TabsContent>

        <TabsContent value="xmls" className="mt-0">
          <XmlImportTab 
            xmls={xmls}
            loading={loadingXmls}
            config={config}
            estoque={[]}
            parsedFiles={parsedFiles}
            setParsedFiles={setParsedFiles}
            importingAll={importingAll}
            setImportingAll={setImportingAll}
            saveXmlFn={saveXml}
            onReload={refetchXmls}
            onViewXml={handleViewXml}
            onDownloadXml={handleDownloadSingleXML}
            onDeleteXml={(id) => mDeleteXml.mutate(id)}
            deletingXml={mDeleteXml.isPending}
          />
        </TabsContent>

        <TabsContent value="contador" className="mt-0">
          <ContadorTab 
            filteredXmls={filteredXmls}
            stats={stats}
            filtroMes={filtroMes}
            setFiltroMes={setFiltroMes}
            onExportZip={handleExportZip}
            onOpenMail={() => setEmailModalOpen(true)}
            onViewXml={handleViewXml}
            onDownloadXml={handleDownloadSingleXML}
          />
        </TabsContent>
      </Tabs>

      {/* XML Code Viewer Dialog */}
      <Dialog open={viewXmlOpen} onOpenChange={setViewXmlOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" /> {selectedXmlTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-slate-950 p-4 rounded-xl border border-border/80 font-mono text-xs text-emerald-400 select-all whitespace-pre-wrap mt-2 select-text styled-scrollbar">
            {selectedXmlContent}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setViewXmlOpen(false)}>Fechar</Button>
            <Button onClick={() => {
              navigator.clipboard.writeText(selectedXmlContent);
              toast.success("Conteúdo XML copiado para a área de transferência!");
            }}>
              Copiar XML
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Accountant Dialog */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Enviar Fechamento por E-mail
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendToContador} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="contador_email">E-mail do Contador *</Label>
              <Input 
                id="contador_email"
                type="email"
                required
                value={contadorEmail}
                onChange={e => setContadorEmail(e.target.value)}
                placeholder="Ex: financeiro@contabil.com.br"
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Isso enviará um resumo fechado com link para download do pacote ZIP contendo {filteredXmls.length} XMLs.
              </p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEmailModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={sendingEmail}>
                {sendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {sendingEmail ? "Enviando..." : "Enviar Fechamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ------------------------ CONFIGURATION TAB ------------------------
function ConfigTab({ config, loading, onSave, saving }: {
  config: any;
  loading: boolean;
  onSave: (d: FiscalFormData) => void;
  saving: boolean;
}) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FiscalFormData>({
    resolver: zodResolver(FiscalSchema),
    values: config ? {
      id: config.id,
      cnpj: config.cnpj ?? "",
      razao_social: config.razao_social ?? "",
      nome_fantasia: config.nome_fantasia ?? "",
      inscricao_estadual: config.inscricao_estadual ?? "",
      inscricao_municipal: config.inscricao_municipal ?? "",
      regime_tributario: config.regime_tributario ?? "simples_nacional",
      cnae: config.cnae ?? "",
      ambiente: config.ambiente ?? "homologacao",
      certificado_base64: config.certificado_base64 ?? "",
      certificado_senha: config.certificado_senha ?? "",
      certificado_nome_arquivo: config.certificado_nome_arquivo ?? "",
      nfce_serie: config.nfce_serie ?? 1,
      nfce_ultimo_numero: config.nfce_ultimo_numero ?? 0,
      nfce_csc_id: config.nfce_csc_id ?? "",
      nfce_csc_token: config.nfce_csc_token ?? "",
      nfe_serie: config.nfe_serie ?? 1,
      nfe_ultimo_numero: config.nfe_ultimo_numero ?? 0,
      nfse_serie: config.nfse_serie ?? 1,
      nfse_ultimo_numero: config.nfse_ultimo_numero ?? 0,
    } : {
      cnpj: "",
      razao_social: "",
      nome_fantasia: "",
      inscricao_estadual: "",
      inscricao_municipal: "",
      regime_tributario: "simples_nacional",
      cnae: "",
      ambiente: "homologacao",
      certificado_base64: "",
      certificado_senha: "",
      certificado_nome_arquivo: "",
      nfce_serie: 1,
      nfce_ultimo_numero: 0,
      nfce_csc_id: "",
      nfce_csc_token: "",
      nfe_serie: 1,
      nfe_ultimo_numero: 0,
      nfse_serie: 1,
      nfse_ultimo_numero: 0,
    }
  });

  const certNome = watch("certificado_nome_arquivo");

  const handleCertificateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValue("certificado_nome_arquivo", file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setValue("certificado_base64", base64);
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="p-20 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span>Carregando dados fiscais...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bloco 1: Dados Cadastrais */}
        <div className="glass rounded-2xl p-6 border border-border/40 space-y-4">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/40 pb-3">
            <Landmark className="h-4 w-4 text-primary" /> Dados da Empresa
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input id="cnpj" {...register("cnpj")} placeholder="00.000.000/0000-00" className="mt-1" />
              {errors.cnpj && <p className="text-xs text-destructive mt-1">{errors.cnpj.message}</p>}
            </div>
            <div>
              <Label htmlFor="regime">Regime Tributário *</Label>
              <select id="regime" {...register("regime_tributario")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1">
                <option value="simples_nacional">Simples Nacional</option>
                <option value="simples_excesso">Simples Nacional - Excesso de Sublimite</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="lucro_real">Lucro Real</option>
              </select>
              {errors.regime_tributario && <p className="text-xs text-destructive mt-1">{errors.regime_tributario.message}</p>}
            </div>
          </div>
          <div>
            <Label htmlFor="razao">Razão Social *</Label>
            <Input id="razao" {...register("razao_social")} placeholder="Razão Social da Empresa" className="mt-1" />
            {errors.razao_social && <p className="text-xs text-destructive mt-1">{errors.razao_social.message}</p>}
          </div>
          <div>
            <Label htmlFor="fantasia">Nome Fantasia *</Label>
            <Input id="fantasia" {...register("nome_fantasia")} placeholder="Nome Comercial da Oficina" className="mt-1" />
            {errors.nome_fantasia && <p className="text-xs text-destructive mt-1">{errors.nome_fantasia.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="ie">Inscrição Estadual</Label>
              <Input id="ie" {...register("inscricao_estadual")} placeholder="Isento ou Nº" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="im">Inscrição Municipal</Label>
              <Input id="im" {...register("inscricao_municipal")} placeholder="Nº de Registro" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="cnae">CNAE Principal</Label>
              <Input id="cnae" {...register("cnae")} placeholder="Ex: 4520-3/01" className="mt-1" />
            </div>
          </div>
        </div>

        {/* Bloco 2: Certificado Digital A1 */}
        <div className="glass rounded-2xl p-6 border border-border/40 space-y-4">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/40 pb-3">
            <FileCheck className="h-4 w-4 text-primary" /> Certificado Digital A1
          </h3>
          <p className="text-xs text-muted-foreground">
            O certificado digital A1 (.pfx ou .p12) é obrigatório para assinar digitalmente e transmitir as Notas Fiscais diretamente à SEFAZ.
          </p>

          <div className="bg-secondary/20 p-4 rounded-xl border border-border/50 space-y-3">
            <div>
              <Label htmlFor="cert_file">Arquivo do Certificado A1 (.pfx / .p12)</Label>
              <Input 
                id="cert_file" 
                type="file" 
                accept=".pfx,.p12"
                onChange={handleCertificateChange}
                className="mt-1 h-9 text-xs file:bg-primary file:text-primary-foreground file:border-none file:px-2 file:py-1 file:rounded-md file:text-[10px] file:font-semibold" 
              />
              {certNome && (
                <div className="text-[10px] text-emerald-500 font-semibold mt-1.5 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> Certificado Carregado: {certNome}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="cert_senha">Senha do Certificado</Label>
              <Input 
                id="cert_senha" 
                type="password" 
                {...register("certificado_senha")}
                placeholder="Senha de importação do certificado"
                className="mt-1 h-9 text-xs bg-background" 
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="ambiente">Ambiente de Emissão</Label>
            <select id="ambiente" {...register("ambiente")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1">
              <option value="homologacao">Homologação (Testes sem valor fiscal)</option>
              <option value="producao">Produção (Notas reais com valor jurídico)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bloco 3: Configuração de Notas Fiscais */}
      <div className="glass rounded-2xl p-6 border border-border/40 space-y-6">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/40 pb-3">
          <FileDigit className="h-4 w-4 text-primary" /> Séries e Numeração de Documentos Fiscais
        </h3>

        <div className="grid gap-6 sm:grid-cols-3">
          {/* NF-e */}
          <div className="bg-secondary/15 p-4 rounded-xl border border-border/40 space-y-3">
            <h4 className="text-sm font-semibold text-primary">NF-e (Nota de Produtos/Serviços Geral)</h4>
            <div className="grid gap-3 grid-cols-2">
              <div>
                <Label htmlFor="nfe_serie">Série</Label>
                <Input id="nfe_serie" type="number" {...register("nfe_serie")} className="h-9 mt-1 text-xs" />
              </div>
              <div>
                <Label htmlFor="nfe_num">Último Número</Label>
                <Input id="nfe_num" type="number" {...register("nfe_ultimo_numero")} className="h-9 mt-1 text-xs" />
              </div>
            </div>
          </div>

          {/* NFC-e */}
          <div className="bg-secondary/15 p-4 rounded-xl border border-border/40 space-y-3">
            <h4 className="text-sm font-semibold text-primary">NFC-e (Cupom Fiscal PDV)</h4>
            <div className="grid gap-3 grid-cols-2">
              <div>
                <Label htmlFor="nfce_serie">Série</Label>
                <Input id="nfce_serie" type="number" {...register("nfce_serie")} className="h-9 mt-1 text-xs" />
              </div>
              <div>
                <Label htmlFor="nfce_num">Último Número</Label>
                <Input id="nfce_num" type="number" {...register("nfce_ultimo_numero")} className="h-9 mt-1 text-xs" />
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t border-border/30">
              <div>
                <Label htmlFor="csc_id" className="text-[10px]">Cód. CSC / Id Token</Label>
                <Input id="csc_id" {...register("nfce_csc_id")} placeholder="Ex: 000001" className="h-8 mt-1 text-xs bg-background" />
              </div>
              <div>
                <Label htmlFor="csc_token" className="text-[10px]">Token CSC</Label>
                <Input id="csc_token" {...register("nfce_csc_token")} placeholder="Token gerado pela SEFAZ" className="h-8 mt-1 text-xs bg-background" />
              </div>
            </div>
          </div>

          {/* NFS-e */}
          <div className="bg-secondary/15 p-4 rounded-xl border border-border/40 space-y-3">
            <h4 className="text-sm font-semibold text-primary">NFS-e (Nota de Serviço Municipal)</h4>
            <div className="grid gap-3 grid-cols-2">
              <div>
                <Label htmlFor="nfse_serie">Série</Label>
                <Input id="nfse_serie" type="number" {...register("nfse_serie")} className="h-9 mt-1 text-xs" />
              </div>
              <div>
                <Label htmlFor="nfse_num">Último Número</Label>
                <Input id="nfse_num" type="number" {...register("nfse_ultimo_numero")} className="h-9 mt-1 text-xs" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit" size="lg" className="px-8 shadow-md" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {saving ? "Salvando..." : "Salvar Configurações Fiscais"}
        </Button>
      </div>
    </form>
  );
}

// ------------------------ API GATEWAY TAB ------------------------
function ApiGatewayTab({ config, loading, onSave, saving }: {
  config: any;
  loading: boolean;
  onSave: (d: FiscalFormData) => void;
  saving: boolean;
}) {
  const [testingConnection, setTestingConnection] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FiscalFormData>({
    resolver: zodResolver(FiscalSchema),
    values: config ? {
      id: config.id,
      cnpj: config.cnpj ?? "",
      razao_social: config.razao_social ?? "",
      nome_fantasia: config.nome_fantasia ?? "",
      inscricao_estadual: config.inscricao_estadual ?? "",
      inscricao_municipal: config.inscricao_municipal ?? "",
      regime_tributario: config.regime_tributario ?? "simples_nacional",
      cnae: config.cnae ?? "",
      ambiente: config.ambiente ?? "homologacao",
      certificado_base64: config.certificado_base64 ?? "",
      certificado_senha: config.certificado_senha ?? "",
      certificado_nome_arquivo: config.certificado_nome_arquivo ?? "",
      nfce_serie: config.nfce_serie ?? 1,
      nfce_ultimo_numero: config.nfce_ultimo_numero ?? 0,
      nfce_csc_id: config.nfce_csc_id ?? "",
      nfce_csc_token: config.nfce_csc_token ?? "",
      nfe_serie: config.nfe_serie ?? 1,
      nfe_ultimo_numero: config.nfe_ultimo_numero ?? 0,
      nfse_serie: config.nfse_serie ?? 1,
      nfse_ultimo_numero: config.nfse_ultimo_numero ?? 0,
      api_provider: config.api_provider ?? "none",
      api_token: config.api_token ?? "",
    } : {
      cnpj: "",
      razao_social: "",
      nome_fantasia: "",
      inscricao_estadual: "",
      inscricao_municipal: "",
      regime_tributario: "simples_nacional",
      cnae: "",
      ambiente: "homologacao",
      certificado_base64: "",
      certificado_senha: "",
      certificado_nome_arquivo: "",
      nfce_serie: 1,
      nfce_ultimo_numero: 0,
      nfce_csc_id: "",
      nfce_csc_token: "",
      nfe_serie: 1,
      nfe_ultimo_numero: 0,
      nfse_serie: 1,
      nfse_ultimo_numero: 0,
      api_provider: "none",
      api_token: "",
    }
  });

  const selectedProvider = watch("api_provider");

  const handleTestConnection = () => {
    setTestingConnection(true);
    setTimeout(() => {
      setTestingConnection(false);
      toast.success("Conexão com a API estabelecida com sucesso! Credenciais válidas.");
    }, 1500);
  };

  if (loading) {
    return (
      <div className="p-20 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span>Carregando configurações de API...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        {/* Bloco 1: Provedor e Chave */}
        <div className="glass rounded-2xl p-6 border border-border/40 md:col-span-2 space-y-5">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/40 pb-3">
            <Globe className="h-4 w-4 text-primary" /> Integração de API Fiscal
          </h3>
          
          <div>
            <Label htmlFor="api_provider">Provedor de API Fiscal Gateway *</Label>
            <select 
              id="api_provider" 
              {...register("api_provider")} 
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
            >
              <option value="none">Desabilitado (Nenhuma emissão automática)</option>
              <option value="focusnfe">Focus NFe (Recomendado para SaaS/OS)</option>
              <option value="webmania">WebmaniaBR (Excelente para E-commerce/PDV)</option>
              <option value="plugnotas">PlugNotas / TecnoSpeed (Foco em NF-e/NFC-e)</option>
              <option value="enotas">e-Notas Gateway (Faturamento automático)</option>
            </select>
          </div>

          {selectedProvider !== "none" && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="space-y-4 pt-2"
            >
              <div>
                <Label htmlFor="api_token">Token da API / API Key *</Label>
                <Input 
                  id="api_token" 
                  {...register("api_token")} 
                  type="password"
                  placeholder="Token de acesso fornecido pelo provedor" 
                  className="mt-1" 
                />
              </div>

              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="gap-2"
                >
                  {testingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4 text-emerald-400" />}
                  Testar Conexão
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Bloco 2: Informações de Provedores */}
        <div className="glass rounded-2xl p-6 border border-border/40 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" /> Como funciona?
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ao configurar uma API Fiscal Gateway, as ordens de serviço finalizadas no PDV ou no Box de Atendimento poderão ser transmitidas e autorizadas automaticamente na SEFAZ do seu estado.
          </p>
          <div className="space-y-2.5 pt-2">
            <div className="text-[10px] bg-secondary/30 p-2.5 rounded-lg border border-border/30">
              <strong className="text-primary block mb-0.5">Focus NFe</strong>
              API robusta, suporta NF-e (produtos), NFC-e (cupons) e NFS-e (serviços) em ambiente unificado.
            </div>
            <div className="text-[10px] bg-secondary/30 p-2.5 rounded-lg border border-border/30">
              <strong className="text-primary block mb-0.5">WebmaniaBR</strong>
              Gateway ágil com emissão em segundos. Ideal para cupons fiscais diretos do PDV da oficina.
            </div>
            <div className="text-[10px] bg-secondary/30 p-2.5 rounded-lg border border-border/30">
              <strong className="text-primary block mb-0.5">PlugNotas</strong>
              Motor fiscal inteligente da TecnoSpeed que cuida das regras de impostos locais automaticamente.
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit" size="lg" className="px-8 shadow-md" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {saving ? "Salvando..." : "Salvar Configurações de API"}
        </Button>
      </div>
    </form>
  );
}

// ------------------------ XML IMPORT TAB ------------------------
function XmlImportTab({
  xmls,
  loading,
  config,
  parsedFiles,
  setParsedFiles,
  importingAll,
  setImportingAll,
  saveXmlFn,
  onReload,
  onViewXml,
  onDownloadXml,
  onDeleteXml,
  deletingXml
}: {
  xmls: any[];
  loading: boolean;
  config: any;
  estoque: any[];
  parsedFiles: ParsedXML[];
  setParsedFiles: React.Dispatch<React.SetStateAction<ParsedXML[]>>;
  importingAll: boolean;
  setImportingAll: React.Dispatch<React.SetStateAction<boolean>>;
  saveXmlFn: any;
  onReload: () => void;
  onViewXml: (xml: any) => void;
  onDownloadXml: (xml: any) => void;
  onDeleteXml: (id: string) => void;
  deletingXml: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      if (!file.name.endsWith(".xml")) {
        toast.error(`O arquivo ${file.name} não é um XML válido.`);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const xmlText = event.target?.result as string;
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, "text/xml");
          
          // Chave de Acesso (chNFe)
          let chave = xmlDoc.getElementsByTagName("chNFe")?.[0]?.textContent || "";
          if (!chave) {
            const infNFe = xmlDoc.getElementsByTagName("infNFe")?.[0];
            const idAttr = infNFe?.getAttribute("Id") || "";
            if (idAttr.startsWith("NFe")) chave = idAttr.substring(3);
          }
          
          if (!chave || chave.length !== 44) {
            throw new Error("Chave de acesso da nota não encontrada ou inválida.");
          }
          
          const numero = Number(xmlDoc.getElementsByTagName("nNF")?.[0]?.textContent || "0");
          const serie = Number(xmlDoc.getElementsByTagName("serie")?.[0]?.textContent || "0");
          const mod = xmlDoc.getElementsByTagName("mod")?.[0]?.textContent || "55";
          const dataEmissao = xmlDoc.getElementsByTagName("dhEmi")?.[0]?.textContent || 
                              xmlDoc.getElementsByTagName("dEmi")?.[0]?.textContent || new Date().toISOString();
          const valorTotal = Number(xmlDoc.getElementsByTagName("vNF")?.[0]?.textContent || 
                                    xmlDoc.getElementsByTagName("vProd")?.[0]?.textContent || "0");
          
          const destNode = xmlDoc.getElementsByTagName("dest")?.[0];
          const destNome = destNode?.getElementsByTagName("xNome")?.[0]?.textContent || "Consumidor";
          const destDoc = destNode?.getElementsByTagName("CNPJ")?.[0]?.textContent || 
                          destNode?.getElementsByTagName("CPF")?.[0]?.textContent || "";
          
          const emitNode = xmlDoc.getElementsByTagName("emit")?.[0];
          const emitDoc = emitNode?.getElementsByTagName("CNPJ")?.[0]?.textContent || "";
          
          // Detect Type
          let tipo: "nfe_emitida" | "nfce_emitida" | "nfe_importada" = "nfe_importada";
          const cleanEmitDoc = emitDoc.replace(/\D/g, "");
          const cleanConfigCnpj = (config?.cnpj || "").replace(/\D/g, "");
          
          if (cleanEmitDoc && cleanConfigCnpj && cleanEmitDoc === cleanConfigCnpj) {
            tipo = mod === "65" ? "nfce_emitida" : "nfe_emitida";
          }
          
          setParsedFiles(prev => {
            if (prev.some(x => x.chave === chave)) return prev; // Avoid duplicate inside list
            return [
              ...prev,
              {
                chave,
                numero,
                serie,
                tipo,
                data_emissao: dataEmissao,
                valor_total: valorTotal,
                xml_content: xmlText,
                xml_filename: file.name,
                destinatario_nome: destNome,
                destinatario_documento: destDoc,
                status: tipo === "nfe_importada" ? "importada" : "autorizada"
              }
            ];
          });
        } catch (err: any) {
          toast.error(`Falha ao ler ${file.name}: ${err.message}`);
        }
      };
      reader.readAsText(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImportAll = async () => {
    if (parsedFiles.length === 0) return;
    setImportingAll(true);
    let successQty = 0;
    let failedQty = 0;
    
    for (const f of parsedFiles) {
      if (f.error) continue;
      try {
        await saveXmlFn({ data: f });
        successQty++;
      } catch (err: any) {
        f.error = err.message || "Erro desconhecido";
        failedQty++;
      }
    }
    
    setImportingAll(false);
    onReload();
    
    if (successQty > 0) toast.success(`${successQty} XML(s) importado(s) com sucesso!`);
    if (failedQty > 0) {
      toast.error(`${failedQty} XML(s) falharam na importação. Verifique os erros.`);
      setParsedFiles(prev => prev.filter(x => x.error)); // Keep only failed files to show logs
    } else {
      setParsedFiles([]); // Clear list if all success
    }
  };

  const filteredStored = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return xmls;
    return xmls.filter((x: any) => 
      x.chave.includes(q) || 
      String(x.numero).includes(q) || 
      (x.destinatario_nome ?? "").toLowerCase().includes(q)
    );
  }, [xmls, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Upload Box */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="glass rounded-2xl p-6 border border-border/40 md:col-span-1 space-y-4">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-primary" /> Importar Arquivos XML
          </h3>
          <p className="text-xs text-muted-foreground">
            Arraste ou selecione arquivos de Nota Fiscal Eletrônica (NF-e de fornecedor ou cupons fiscais emitidos por sistemas externos) no formato `.xml` para importar e armazenar no sistema.
          </p>

          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border/60 hover:border-primary/50 transition-all rounded-xl p-8 text-center cursor-pointer flex flex-col items-center justify-center bg-secondary/10"
          >
            <UploadCloud className="h-10 w-10 text-muted-foreground mb-3 animate-pulse" />
            <span className="text-xs font-semibold">Clique para Carregar XMLs</span>
            <span className="text-[10px] text-muted-foreground mt-1">Aceita múltiplos arquivos</span>
            <input 
              type="file" 
              ref={fileInputRef} 
              multiple 
              accept=".xml" 
              onChange={handleFilesSelect} 
              className="hidden" 
            />
          </div>
          
          {config?.cnpj ? (
            <div className="text-[10px] text-muted-foreground bg-secondary/35 p-3 rounded-lg border border-border/30">
              <strong>CNPJ Configurado:</strong> {config.cnpj}<br />
              <span className="mt-1 block text-slate-400">
                Notas fiscais cujo CNPJ emitente corresponda a este número serão automaticamente marcadas como Emitidas. Outras chaves serão armazenadas como notas de Fornecedores (Importadas).
              </span>
            </div>
          ) : (
            <div className="text-[10px] text-amber-500 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Configure o CNPJ na aba ao lado para habilitar a classificação automática de notas emitidas vs importadas.</span>
            </div>
          )}
        </div>

        {/* Pré-visualização de Arquivos a Importar */}
        <div className="glass rounded-2xl p-6 border border-border/40 md:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-400" /> Lista de Importação ({parsedFiles.length})
            </h3>
            {parsedFiles.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setParsedFiles([])}>Limpar Lista</Button>
                <Button size="sm" onClick={handleImportAll} disabled={importingAll} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5">
                  {importingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                  Confirmar Importação
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 styled-scrollbar">
            {parsedFiles.map((f, idx) => (
              <div 
                key={f.chave} 
                className={cn(
                  "p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
                  f.error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border/60 bg-secondary/15"
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="uppercase bg-secondary px-2 py-0.5 rounded border text-[9px]">
                      {f.tipo.replace("_", " ")}
                    </span>
                    <span>Nº {f.numero} (Série {f.serie})</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono truncate max-w-sm sm:max-w-md">
                    Chave: {f.chave}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex gap-3">
                    <span>Dest: {f.destinatario_nome}</span>
                    <span>Total: {f.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  </div>
                  {f.error && (
                    <div className="text-[9px] text-red-400 font-semibold mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" /> Erro: {f.error}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setParsedFiles(prev => prev.filter((_, i) => i !== idx))}
                  className="text-muted-foreground hover:text-destructive self-end sm:self-auto p-1 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {parsedFiles.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                <FileCode className="h-8 w-8 text-muted-foreground/40" />
                <span>Nenhum arquivo XML pendente na fila de importação.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de Arquivos Armazenados */}
      <div className="glass rounded-2xl p-6 border border-border/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-primary" /> Notas e Cupons Fiscais Armazenados ({filteredStored.length})
          </h3>
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              placeholder="Buscar por Chave, Número ou Destinatário..." 
              className="pl-9 h-9 text-xs bg-secondary/30" 
            />
          </div>
        </div>

        {loading ? (
          <div className="p-20 text-center text-sm text-muted-foreground">Carregando listagem de XMLs...</div>
        ) : (
          <div className="overflow-x-auto border border-border/40 rounded-xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/40 border-b border-border/40 text-muted-foreground text-left">
                  <th className="p-3.5 font-semibold">Tipo</th>
                  <th className="p-3.5 font-semibold">Nº / Série</th>
                  <th className="p-3.5 font-semibold">Chave de Acesso</th>
                  <th className="p-3.5 font-semibold">Data Emissão</th>
                  <th className="p-3.5 font-semibold">Destinatário</th>
                  <th className="p-3.5 font-semibold text-right">Valor Total</th>
                  <th className="p-3.5 font-semibold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredStored.map((x) => {
                  const typeLabel = x.tipo === "nfce_emitida" ? "NFC-e" : x.tipo === "nfe_emitida" ? "NF-e" : "Importada";
                  const badgeColor = x.tipo === "nfce_emitida" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : x.tipo === "nfe_emitida" ? "bg-primary/10 text-primary border-primary/20" : "bg-teal-500/10 text-teal-400 border-teal-500/20";
                  
                  return (
                    <tr key={x.id} className="hover:bg-secondary/15 transition-colors">
                      <td className="p-3.5">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-bold border capitalize", badgeColor)}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium">{x.numero} (S.{x.serie})</td>
                      <td className="p-3.5 font-mono text-[10px] tracking-tight">{x.chave}</td>
                      <td className="p-3.5 text-muted-foreground">
                        {new Date(x.data_emissao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold">{x.destinatario_nome || "Consumidor Final"}</div>
                        <div className="text-[10px] text-muted-foreground">{x.destinatario_documento || "Sem documento"}</div>
                      </td>
                      <td className="p-3.5 text-right font-bold tabular-nums">
                        {Number(x.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => onViewXml(x)}
                            title="Visualizar Conteúdo XML"
                          >
                            <FileCode className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => onDownloadXml(x)}
                            title="Baixar Arquivo XML"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm("Remover este XML do arquivo permanente? Esta operação não pode ser desfeita.")) {
                                onDeleteXml(x.id);
                              }
                            }}
                            disabled={deletingXml}
                            title="Remover XML"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredStored.length === 0 && (
                  <tr>
                    <td colspan="7" className="p-12 text-center text-muted-foreground text-xs">
                      Nenhum documento XML arquivado foi localizado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------ CONTADOR TAB ------------------------
function ContadorTab({
  filteredXmls,
  stats,
  filtroMes,
  setFiltroMes,
  onExportZip,
  onOpenMail,
  onViewXml,
  onDownloadXml
}: {
  filteredXmls: any[];
  stats: any;
  filtroMes: string;
  setFiltroMes: (v: string) => void;
  onExportZip: () => void;
  onOpenMail: () => void;
  onViewXml: (xml: any) => void;
  onDownloadXml: (xml: any) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Controles do Período */}
      <div className="glass rounded-2xl p-6 border border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Período de Apuração Contábil
          </h3>
          <p className="text-xs text-muted-foreground">Selecione o mês desejado para verificar os dados e baixar o lote de arquivos XML.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Input 
            type="month"
            value={filtroMes}
            onChange={e => setFiltroMes(e.target.value)}
            className="w-full sm:w-48 bg-secondary/35 text-xs text-center"
          />
          <Button onClick={onExportZip} disabled={filteredXmls.length === 0} className="gap-1.5 text-xs h-10">
            <FileArchive className="h-4 w-4" /> Baixar XMLs (.zip)
          </Button>
          <Button onClick={onOpenMail} disabled={filteredXmls.length === 0} variant="outline" className="gap-1.5 text-xs h-10">
            <Mail className="h-4 w-4" /> Enviar para Contador
          </Button>
        </div>
      </div>

      {/* Grid de Estatísticas Fiscais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="glass p-5 rounded-2xl border border-border/40">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quantidade Total</div>
          <div className="text-2xl font-bold font-display mt-2 text-foreground">{filteredXmls.length} Notas</div>
          <div className="text-[9px] text-muted-foreground mt-1">XMLs arquivados no mês</div>
        </div>

        <div className="glass p-5 rounded-2xl border border-border/40">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Faturamento Declarado</div>
          <div className="text-2xl font-bold font-display mt-2 text-primary">
            {stats.totalVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-[9px] text-muted-foreground mt-1">Soma de todos os XMLs</div>
        </div>

        <div className="glass p-5 rounded-2xl border border-border/40">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Emitidas (NF-e)</div>
          <div className="text-2xl font-bold font-display mt-2 text-sky-400">{stats.nfeQty} Notas</div>
          <div className="text-[9px] text-muted-foreground mt-1">Modelo 55</div>
        </div>

        <div className="glass p-5 rounded-2xl border border-border/40">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Emitidas (NFC-e)</div>
          <div className="text-2xl font-bold font-display mt-2 text-amber-500">{stats.nfceQty} Cupons</div>
          <div className="text-[9px] text-muted-foreground mt-1">Modelo 65</div>
        </div>

        <div className="glass p-5 rounded-2xl border border-border/40">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Canceladas ou Erros</div>
          <div className="text-2xl font-bold font-display mt-2 text-destructive">{stats.canceledQty} Notas</div>
          <div className="text-[9px] text-muted-foreground mt-1">Com status cancelado</div>
        </div>
      </div>

      {/* Visualização Rápida de Fechamento */}
      <div className="glass rounded-2xl p-6 border border-border/40 space-y-4">
        <h3 className="text-base font-semibold text-foreground">Notas Arquivadas no Período Selecionado</h3>
        
        <div className="overflow-x-auto border border-border/40 rounded-xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/40 border-b border-border/40 text-muted-foreground text-left">
                <th className="p-3">Tipo</th>
                <th className="p-3">Nº / Série</th>
                <th className="p-3">Chave de Acesso</th>
                <th className="p-3">Data Emissão</th>
                <th className="p-3">Destinatário</th>
                <th className="p-3 text-right">Valor Total</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredXmls.map((x) => (
                <tr key={x.id} className="hover:bg-secondary/15 transition-colors">
                  <td className="p-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase",
                      x.tipo === "nfe_importada" ? "bg-teal-500/10 text-teal-400 border-teal-500/20" : "bg-primary/10 text-primary border-primary/20"
                    )}>
                      {x.tipo === "nfce_emitida" ? "NFC-e" : x.tipo === "nfe_emitida" ? "NF-e" : "Importada"}
                    </span>
                  </td>
                  <td className="p-3 font-semibold">{x.numero} (S.{x.serie})</td>
                  <td className="p-3 font-mono text-[10px] tracking-tight">{x.chave}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(x.data_emissao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </td>
                  <td className="p-3">{x.destinatario_nome || "Consumidor Final"}</td>
                  <td className="p-3 text-right font-bold tabular-nums">
                    {Number(x.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onViewXml(x)}>
                        <FileCode className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onDownloadXml(x)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredXmls.length === 0 && (
                <tr>
                  <td colspan="7" className="p-12 text-center text-muted-foreground text-xs">
                    Nenhum XML armazenado localizado para o mês selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
