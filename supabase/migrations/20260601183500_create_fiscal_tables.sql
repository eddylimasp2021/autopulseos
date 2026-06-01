-- Tabela de Configurações Fiscais
CREATE TABLE IF NOT EXISTS public.fiscal_config (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id uuid NOT NULL,
    cnpj text,
    razao_social text,
    nome_fantasia text,
    inscricao_estadual text,
    inscricao_municipal text,
    regime_tributario text,
    cnae text,
    ambiente text NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
    
    certificado_base64 text,
    certificado_senha text,
    certificado_nome_arquivo text,
    
    nfce_serie integer NOT NULL DEFAULT 1,
    nfce_ultimo_numero integer NOT NULL DEFAULT 0,
    nfce_csc_id text,
    nfce_csc_token text,
    
    nfe_serie integer NOT NULL DEFAULT 1,
    nfe_ultimo_numero integer NOT NULL DEFAULT 0,
    
    nfse_serie integer NOT NULL DEFAULT 1,
    nfse_ultimo_numero integer NOT NULL DEFAULT 0,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de Armazenamento de XMLs Fiscais
CREATE TABLE IF NOT EXISTS public.fiscal_xmls (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id uuid NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('nfe_emitida', 'nfce_emitida', 'nfe_importada')),
    chave text NOT NULL CHECK (length(chave) = 44),
    numero integer NOT NULL,
    serie integer NOT NULL,
    data_emissao timestamptz NOT NULL,
    valor_total numeric(12,2) NOT NULL DEFAULT 0,
    xml_content text NOT NULL,
    xml_filename text NOT NULL,
    destinatario_nome text,
    destinatario_documento text,
    status text NOT NULL DEFAULT 'autorizada' CHECK (status IN ('autorizada', 'cancelada', 'importada')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fiscal_config_workshop ON public.fiscal_config(workshop_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_xmls_workshop ON public.fiscal_xmls(workshop_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_xmls_tipo ON public.fiscal_xmls(workshop_id, tipo);
CREATE INDEX IF NOT EXISTS idx_fiscal_xmls_chave ON public.fiscal_xmls(workshop_id, chave);

-- Habilitar RLS
ALTER TABLE public.fiscal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_xmls ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "members view fiscal_config" ON public.fiscal_config FOR SELECT TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members insert fiscal_config" ON public.fiscal_config FOR INSERT TO authenticated WITH CHECK (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members update fiscal_config" ON public.fiscal_config FOR UPDATE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members delete fiscal_config" ON public.fiscal_config FOR DELETE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));

CREATE POLICY "members view fiscal_xmls" ON public.fiscal_xmls FOR SELECT TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members insert fiscal_xmls" ON public.fiscal_xmls FOR INSERT TO authenticated WITH CHECK (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members update fiscal_xmls" ON public.fiscal_xmls FOR UPDATE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members delete fiscal_xmls" ON public.fiscal_xmls FOR DELETE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));

-- Triggers de workshop_id automático
CREATE TRIGGER trg_fiscal_config_workshop BEFORE INSERT ON public.fiscal_config FOR EACH ROW EXECUTE FUNCTION public.set_workshop_id_default();
CREATE TRIGGER trg_fiscal_xmls_workshop BEFORE INSERT ON public.fiscal_xmls FOR EACH ROW EXECUTE FUNCTION public.set_workshop_id_default();
