-- Tabela de histórico de Caixas
CREATE TABLE public.pdv_caixas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workshop_id uuid NOT NULL,
  operador_nome text NOT NULL,
  status text NOT NULL CHECK (status IN ('aberto', 'fechado')) DEFAULT 'aberto',
  saldo_abertura numeric NOT NULL DEFAULT 0,
  saldo_fechamento numeric,
  data_abertura timestamptz NOT NULL DEFAULT now(),
  data_fechamento timestamptz,
  observacoes text
);

-- Índices e RLS
CREATE INDEX idx_pdv_caixas_workshop ON public.pdv_caixas(workshop_id);
CREATE INDEX idx_pdv_caixas_status ON public.pdv_caixas(workshop_id, status);

ALTER TABLE public.pdv_caixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view pdv_caixas" ON public.pdv_caixas FOR SELECT TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members insert pdv_caixas" ON public.pdv_caixas FOR INSERT TO authenticated WITH CHECK (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members update pdv_caixas" ON public.pdv_caixas FOR UPDATE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members delete pdv_caixas" ON public.pdv_caixas FOR DELETE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));

CREATE TRIGGER trg_caixas_workshop BEFORE INSERT ON public.pdv_caixas FOR EACH ROW EXECUTE FUNCTION public.set_workshop_id_default();

-- Adiciona caixa_id aos lançamentos financeiros
ALTER TABLE public.financeiro_lancamentos ADD COLUMN caixa_id uuid REFERENCES public.pdv_caixas(id) ON DELETE SET NULL;
CREATE INDEX idx_fin_caixa ON public.financeiro_lancamentos(caixa_id);
