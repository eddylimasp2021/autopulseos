-- Alterar a tabela fiscal_config para adicionar colunas de API Gateway
ALTER TABLE public.fiscal_config 
ADD COLUMN IF NOT EXISTS api_provider text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS api_token text;

-- Adicionar comentários explicativos para documentação
COMMENT ON COLUMN public.fiscal_config.api_provider IS 'Provedor de API fiscal contratado (ex: focusnfe, webmania, plugnotas, enotas, none)';
COMMENT ON COLUMN public.fiscal_config.api_token IS 'Chave/Token de autenticação para a API fiscal configurada';
