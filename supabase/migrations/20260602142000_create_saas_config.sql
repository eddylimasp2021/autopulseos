-- Tabela para guardar as configuracoes exclusivas do SaaS (Gateway de pagamento, chaves de API do Super Admin)
CREATE TABLE public.saas_config (
  id INT PRIMARY KEY DEFAULT 1,
  asaas_api_key TEXT,
  asaas_webhook_secret TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 1)
);

-- Insere o registro padrao
INSERT INTO public.saas_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Trigger para updated_at
CREATE TRIGGER saas_config_updated_at BEFORE UPDATE ON public.saas_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: A tabela saas_config nao devera ser lida ou escrita diretamente pelos usuarios finais,
-- apenas as server functions (com supabaseAdmin / service_role) terao acesso bypassando o RLS.
-- Porem, por garantia, habilitamos o RLS sem criar politicas (negando acesso direto ao anon/authenticated).
ALTER TABLE public.saas_config ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_config TO authenticated;
GRANT ALL ON public.saas_config TO service_role;
