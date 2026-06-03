CREATE TABLE IF NOT EXISTS public.print_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    tipo_cupom TEXT NOT NULL CHECK (tipo_cupom IN ('venda', 'abertura_caixa', 'fechamento_caixa', 'os')),
    template_base TEXT NOT NULL CHECK (template_base IN ('detalhado', 'minimalista', 'logo_grande', 'compacto')),
    largura_papel TEXT NOT NULL CHECK (largura_papel IN ('58mm', '80mm')),
    tamanho_fonte TEXT NOT NULL CHECK (tamanho_fonte IN ('pequena', 'normal', 'grande')),
    espacamento TEXT NOT NULL CHECK (espacamento IN ('compacto', 'normal', 'largo')),
    cabecalho TEXT,
    rodape TEXT,
    mostrar_logo BOOLEAN DEFAULT false,
    mostrar_endereco BOOLEAN DEFAULT true,
    mostrar_telefone BOOLEAN DEFAULT true,
    mostrar_rodape BOOLEAN DEFAULT true,
    mostrar_obs BOOLEAN DEFAULT true,
    is_padrao BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.print_layouts ENABLE ROW LEVEL SECURITY;

-- Criar políticas
CREATE POLICY "Print Layouts são visíveis para membros do workshop"
ON public.print_layouts FOR SELECT
USING (workshop_id IN (SELECT workshop_id FROM public.workshop_members WHERE user_id = auth.uid()));

CREATE POLICY "Apenas admins/proprietários podem inserir/alterar layouts"
ON public.print_layouts FOR ALL
USING (workshop_id IN (SELECT workshop_id FROM public.workshop_members WHERE user_id = auth.uid() AND role IN ('proprietario', 'admin', 'gerente')))
WITH CHECK (workshop_id IN (SELECT workshop_id FROM public.workshop_members WHERE user_id = auth.uid() AND role IN ('proprietario', 'admin', 'gerente')));
