-- Criação da tabela de fornecedores
CREATE TABLE public.fornecedores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
    nome_fantasia TEXT NOT NULL,
    razao_social TEXT,
    cnpj_cpf TEXT,
    inscricao_estadual TEXT,
    email TEXT,
    telefone TEXT,
    celular TEXT,
    cep TEXT,
    endereco TEXT,
    numero TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    observacoes TEXT,
    status TEXT DEFAULT 'ativo'::TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativa RLS
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

-- Criação de Políticas de Segurança (RLS)
CREATE POLICY "Acesso total aos fornecedores para o dono do workshop"
    ON public.fornecedores
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.workshops w
            WHERE w.id = fornecedores.workshop_id 
            AND w.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.workshops w
            WHERE w.id = fornecedores.workshop_id 
            AND w.user_id = auth.uid()
        )
    );

CREATE POLICY "Membros da oficina podem acessar fornecedores"
    ON public.fornecedores
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 
            FROM public.workshop_users wu 
            WHERE wu.workshop_id = fornecedores.workshop_id 
            AND wu.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM public.workshop_users wu 
            WHERE wu.workshop_id = fornecedores.workshop_id 
            AND wu.user_id = auth.uid()
        )
    );
