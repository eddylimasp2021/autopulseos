-- Create TEF Config table
CREATE TABLE public.tef_config (
    workshop_id UUID PRIMARY KEY REFERENCES public.workshops(id) ON DELETE CASCADE,
    ativo BOOLEAN NOT NULL DEFAULT false,
    ip_servidor TEXT NOT NULL DEFAULT '127.0.0.1',
    porta INTEGER NOT NULL DEFAULT 8080,
    empresa TEXT NOT NULL DEFAULT '00000000',
    terminal TEXT NOT NULL DEFAULT 'SE000001',
    cnpj TEXT,
    timeout INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create TEF Transactions table
CREATE TABLE public.tef_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
    pdv_venda_id UUID REFERENCES public.pdv_vendas(id) ON DELETE SET NULL,
    valor NUMERIC(10,2) NOT NULL,
    tipo TEXT NOT NULL,
    nsu TEXT,
    rede TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    comprovante_cliente TEXT,
    comprovante_loja TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.tef_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tef_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tef_config of their workshops" ON public.tef_config
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.workshop_members
            WHERE workshop_id = tef_config.workshop_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Owners/admins can manage tef_config" ON public.tef_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.workshop_members
            WHERE workshop_id = tef_config.workshop_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can view tef_transactions of their workshops" ON public.tef_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.workshop_members
            WHERE workshop_id = tef_transactions.workshop_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create tef_transactions in their workshops" ON public.tef_transactions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workshop_members
            WHERE workshop_id = tef_transactions.workshop_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update tef_transactions in their workshops" ON public.tef_transactions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.workshop_members
            WHERE workshop_id = tef_transactions.workshop_id AND user_id = auth.uid()
        )
    );
