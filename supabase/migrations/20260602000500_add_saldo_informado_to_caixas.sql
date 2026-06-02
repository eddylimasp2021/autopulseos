-- Alterar a tabela pdv_caixas para adicionar o saldo em dinheiro informado pelo operador no fechamento
ALTER TABLE public.pdv_caixas 
ADD COLUMN IF NOT EXISTS saldo_dinheiro_informado numeric DEFAULT 0;

-- Comentário explicativo
COMMENT ON COLUMN public.pdv_caixas.saldo_dinheiro_informado IS 'Valor físico em dinheiro contato pelo operador e informado no fechamento';
