
-- ============ ENUMS ============
CREATE TYPE public.os_status AS ENUM ('aberta','em_andamento','aguardando_peca','concluida','cancelada','entregue');
CREATE TYPE public.os_item_tipo AS ENUM ('servico','peca');
CREATE TYPE public.troca_oleo_status AS ENUM ('pendente','notificado','realizado');
CREATE TYPE public.estoque_mov_tipo AS ENUM ('entrada','saida','ajuste');
CREATE TYPE public.financeiro_tipo AS ENUM ('receita','despesa');
CREATE TYPE public.financeiro_status AS ENUM ('pendente','pago','atrasado');
CREATE TYPE public.whatsapp_msg_status AS ENUM ('pendente','enviado','falhou');

-- ============ HELPER: default workshop for current user ============
CREATE OR REPLACE FUNCTION public.current_user_default_workshop()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workshop_id FROM public.workshop_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_default_workshop() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_workshop_id_default()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workshop_id IS NULL THEN
    NEW.workshop_id := public.current_user_default_workshop();
  END IF;
  IF NEW.workshop_id IS NULL THEN
    RAISE EXCEPTION 'workshop_id required and no membership found for user';
  END IF;
  IF NOT public.is_workshop_member(auth.uid(), NEW.workshop_id) THEN
    RAISE EXCEPTION 'User is not a member of workshop %', NEW.workshop_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============ CLIENTES ============
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefone text,
  email text,
  documento text,
  endereco text,
  cidade text,
  estado text,
  cep text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clientes_workshop ON public.clientes(workshop_id);
CREATE INDEX idx_clientes_nome ON public.clientes(workshop_id, nome);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view clientes" ON public.clientes FOR SELECT TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members update clientes" ON public.clientes FOR UPDATE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members delete clientes" ON public.clientes FOR DELETE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE TRIGGER trg_clientes_workshop BEFORE INSERT ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.set_workshop_id_default();
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ VEICULOS ============
CREATE TABLE public.veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  placa text NOT NULL,
  marca text,
  modelo text,
  ano integer,
  cor text,
  km_atual integer DEFAULT 0,
  combustivel text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_veiculos_workshop ON public.veiculos(workshop_id);
CREATE INDEX idx_veiculos_cliente ON public.veiculos(cliente_id);
CREATE UNIQUE INDEX idx_veiculos_placa_ws ON public.veiculos(workshop_id, placa);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculos TO authenticated;
GRANT ALL ON public.veiculos TO service_role;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view veiculos" ON public.veiculos FOR SELECT TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members insert veiculos" ON public.veiculos FOR INSERT TO authenticated WITH CHECK (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members update veiculos" ON public.veiculos FOR UPDATE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members delete veiculos" ON public.veiculos FOR DELETE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE TRIGGER trg_veiculos_workshop BEFORE INSERT ON public.veiculos FOR EACH ROW EXECUTE FUNCTION public.set_workshop_id_default();
CREATE TRIGGER trg_veiculos_updated BEFORE UPDATE ON public.veiculos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ORDENS DE SERVIÇO ============
CREATE TABLE public.ordens_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id),
  status public.os_status NOT NULL DEFAULT 'aberta',
  descricao text,
  diagnostico text,
  observacoes text,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  desconto numeric(12,2) NOT NULL DEFAULT 0,
  km_entrada integer,
  mecanico_id uuid,
  data_abertura timestamptz NOT NULL DEFAULT now(),
  data_conclusao timestamptz,
  data_entrega timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_os_workshop ON public.ordens_servico(workshop_id);
CREATE INDEX idx_os_status ON public.ordens_servico(workshop_id, status);
CREATE INDEX idx_os_cliente ON public.ordens_servico(cliente_id);
CREATE INDEX idx_os_veiculo ON public.ordens_servico(veiculo_id);
CREATE UNIQUE INDEX idx_os_numero_ws ON public.ordens_servico(workshop_id, numero);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated;
GRANT ALL ON public.ordens_servico TO service_role;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view os" ON public.ordens_servico FOR SELECT TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members insert os" ON public.ordens_servico FOR INSERT TO authenticated WITH CHECK (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members update os" ON public.ordens_servico FOR UPDATE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members delete os" ON public.ordens_servico FOR DELETE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));

CREATE OR REPLACE FUNCTION public.os_set_numero()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workshop_id IS NULL THEN
    NEW.workshop_id := public.current_user_default_workshop();
  END IF;
  IF NEW.workshop_id IS NULL THEN
    RAISE EXCEPTION 'workshop_id required';
  END IF;
  IF NOT public.is_workshop_member(auth.uid(), NEW.workshop_id) THEN
    RAISE EXCEPTION 'User is not a member of workshop';
  END IF;
  IF NEW.numero IS NULL OR NEW.numero = 0 THEN
    SELECT COALESCE(MAX(numero),0) + 1 INTO NEW.numero
    FROM public.ordens_servico WHERE workshop_id = NEW.workshop_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_os_numero BEFORE INSERT ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION public.os_set_numero();
CREATE TRIGGER trg_os_updated BEFORE UPDATE ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ OS ITENS ============
CREATE TABLE public.os_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tipo public.os_item_tipo NOT NULL,
  descricao text NOT NULL,
  estoque_item_id uuid,
  quantidade numeric(12,3) NOT NULL DEFAULT 1,
  valor_unit numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_os_itens_os ON public.os_itens(os_id);
CREATE INDEX idx_os_itens_workshop ON public.os_itens(workshop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_itens TO authenticated;
GRANT ALL ON public.os_itens TO service_role;
ALTER TABLE public.os_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view os_itens" ON public.os_itens FOR SELECT TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members insert os_itens" ON public.os_itens FOR INSERT TO authenticated WITH CHECK (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members update os_itens" ON public.os_itens FOR UPDATE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members delete os_itens" ON public.os_itens FOR DELETE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE TRIGGER trg_os_itens_workshop BEFORE INSERT ON public.os_itens FOR EACH ROW EXECUTE FUNCTION public.set_workshop_id_default();

-- ============ ESTOQUE ============
CREATE TABLE public.estoque_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  codigo text,
  nome text NOT NULL,
  categoria text,
  unidade text DEFAULT 'un',
  quantidade numeric(12,3) NOT NULL DEFAULT 0,
  qtd_minima numeric(12,3) NOT NULL DEFAULT 0,
  preco_custo numeric(12,2) NOT NULL DEFAULT 0,
  preco_venda numeric(12,2) NOT NULL DEFAULT 0,
  fornecedor text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estoque_workshop ON public.estoque_itens(workshop_id);
CREATE UNIQUE INDEX idx_estoque_codigo_ws ON public.estoque_itens(workshop_id, codigo) WHERE codigo IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_itens TO authenticated;
GRANT ALL ON public.estoque_itens TO service_role;
ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view estoque" ON public.estoque_itens FOR SELECT TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members insert estoque" ON public.estoque_itens FOR INSERT TO authenticated WITH CHECK (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members update estoque" ON public.estoque_itens FOR UPDATE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members delete estoque" ON public.estoque_itens FOR DELETE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE TRIGGER trg_estoque_workshop BEFORE INSERT ON public.estoque_itens FOR EACH ROW EXECUTE FUNCTION public.set_workshop_id_default();
CREATE TRIGGER trg_estoque_updated BEFORE UPDATE ON public.estoque_itens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.estoque_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.estoque_itens(id) ON DELETE CASCADE,
  tipo public.estoque_mov_tipo NOT NULL,
  quantidade numeric(12,3) NOT NULL,
  motivo text,
  os_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estmov_workshop ON public.estoque_movimentacoes(workshop_id);
CREATE INDEX idx_estmov_item ON public.estoque_movimentacoes(item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_movimentacoes TO authenticated;
GRANT ALL ON public.estoque_movimentacoes TO service_role;
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view estmov" ON public.estoque_movimentacoes FOR SELECT TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members insert estmov" ON public.estoque_movimentacoes FOR INSERT TO authenticated WITH CHECK (public.is_workshop_member(auth.uid(), workshop_id));
CREATE TRIGGER trg_estmov_workshop BEFORE INSERT ON public.estoque_movimentacoes FOR EACH ROW EXECUTE FUNCTION public.set_workshop_id_default();

CREATE OR REPLACE FUNCTION public.estoque_aplicar_mov()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE public.estoque_itens SET quantidade = quantidade + NEW.quantidade WHERE id = NEW.item_id;
  ELSIF NEW.tipo = 'saida' THEN
    UPDATE public.estoque_itens SET quantidade = quantidade - NEW.quantidade WHERE id = NEW.item_id;
  ELSIF NEW.tipo = 'ajuste' THEN
    UPDATE public.estoque_itens SET quantidade = NEW.quantidade WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_estmov_apply AFTER INSERT ON public.estoque_movimentacoes FOR EACH ROW EXECUTE FUNCTION public.estoque_aplicar_mov();

-- ============ TROCA DE OLEO ============
CREATE TABLE public.troca_oleo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  os_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  km_atual integer,
  km_proxima integer,
  oleo_tipo text,
  oleo_marca text,
  filtro_oleo text,
  filtro_ar text,
  filtro_combustivel text,
  proxima_data date,
  status public.troca_oleo_status NOT NULL DEFAULT 'realizado',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_oleo_workshop ON public.troca_oleo(workshop_id);
CREATE INDEX idx_oleo_proxima ON public.troca_oleo(workshop_id, proxima_data);
CREATE INDEX idx_oleo_veiculo ON public.troca_oleo(veiculo_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.troca_oleo TO authenticated;
GRANT ALL ON public.troca_oleo TO service_role;
ALTER TABLE public.troca_oleo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view oleo" ON public.troca_oleo FOR SELECT TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members insert oleo" ON public.troca_oleo FOR INSERT TO authenticated WITH CHECK (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members update oleo" ON public.troca_oleo FOR UPDATE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members delete oleo" ON public.troca_oleo FOR DELETE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));

CREATE OR REPLACE FUNCTION public.troca_oleo_calc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workshop_id IS NULL THEN
    NEW.workshop_id := public.current_user_default_workshop();
  END IF;
  IF NEW.proxima_data IS NULL AND NEW.data IS NOT NULL THEN
    NEW.proxima_data := NEW.data + INTERVAL '6 months';
  END IF;
  IF NEW.km_proxima IS NULL AND NEW.km_atual IS NOT NULL THEN
    NEW.km_proxima := NEW.km_atual + 5000;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_oleo_calc BEFORE INSERT ON public.troca_oleo FOR EACH ROW EXECUTE FUNCTION public.troca_oleo_calc();
CREATE TRIGGER trg_oleo_updated BEFORE UPDATE ON public.troca_oleo FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ FINANCEIRO ============
CREATE TABLE public.financeiro_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  tipo public.financeiro_tipo NOT NULL,
  categoria text,
  descricao text NOT NULL,
  valor numeric(12,2) NOT NULL,
  data_vencimento date NOT NULL DEFAULT CURRENT_DATE,
  data_pagamento date,
  status public.financeiro_status NOT NULL DEFAULT 'pendente',
  forma_pagamento text,
  os_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_workshop ON public.financeiro_lancamentos(workshop_id);
CREATE INDEX idx_fin_status ON public.financeiro_lancamentos(workshop_id, status);
CREATE INDEX idx_fin_venc ON public.financeiro_lancamentos(workshop_id, data_vencimento);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_lancamentos TO authenticated;
GRANT ALL ON public.financeiro_lancamentos TO service_role;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view fin" ON public.financeiro_lancamentos FOR SELECT TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members insert fin" ON public.financeiro_lancamentos FOR INSERT TO authenticated WITH CHECK (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members update fin" ON public.financeiro_lancamentos FOR UPDATE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members delete fin" ON public.financeiro_lancamentos FOR DELETE TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE TRIGGER trg_fin_workshop BEFORE INSERT ON public.financeiro_lancamentos FOR EACH ROW EXECUTE FUNCTION public.set_workshop_id_default();
CREATE TRIGGER trg_fin_updated BEFORE UPDATE ON public.financeiro_lancamentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ WHATSAPP CONFIG ============
CREATE TABLE public.whatsapp_config (
  workshop_id uuid PRIMARY KEY REFERENCES public.workshops(id) ON DELETE CASCADE,
  instance_url text,
  token text,
  ativo boolean NOT NULL DEFAULT false,
  template_os_concluida text DEFAULT 'Olá {cliente}, sua OS #{numero} foi concluída! Valor: R$ {valor}. Pode retirar seu veículo. - {oficina}',
  template_os_entregue text DEFAULT 'Olá {cliente}, obrigado pela confiança! Esperamos vê-lo novamente. - {oficina}',
  template_lembrete_oleo text DEFAULT 'Olá {cliente}, está chegando a data da próxima troca de óleo do seu {veiculo} ({placa}). Agende com a gente! - {oficina}',
  template_cobranca text DEFAULT 'Olá {cliente}, lembrete: você tem um pagamento de R$ {valor} com vencimento em {data}. - {oficina}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_config TO authenticated;
GRANT ALL ON public.whatsapp_config TO service_role;
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view wa_config" ON public.whatsapp_config FOR SELECT TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "admins insert wa_config" ON public.whatsapp_config FOR INSERT TO authenticated WITH CHECK (public.has_workshop_role(auth.uid(), workshop_id, 'owner') OR public.has_workshop_role(auth.uid(), workshop_id, 'admin'));
CREATE POLICY "admins update wa_config" ON public.whatsapp_config FOR UPDATE TO authenticated USING (public.has_workshop_role(auth.uid(), workshop_id, 'owner') OR public.has_workshop_role(auth.uid(), workshop_id, 'admin'));
CREATE TRIGGER trg_wa_config_updated BEFORE UPDATE ON public.whatsapp_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ WHATSAPP MENSAGENS ============
CREATE TABLE public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  mensagem text NOT NULL,
  status public.whatsapp_msg_status NOT NULL DEFAULT 'pendente',
  evento text,
  ref_tipo text,
  ref_id uuid,
  tentativas integer NOT NULL DEFAULT 0,
  erro text,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wamsg_workshop ON public.whatsapp_mensagens(workshop_id);
CREATE INDEX idx_wamsg_status ON public.whatsapp_mensagens(status, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_mensagens TO authenticated;
GRANT ALL ON public.whatsapp_mensagens TO service_role;
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view wamsg" ON public.whatsapp_mensagens FOR SELECT TO authenticated USING (public.is_workshop_member(auth.uid(), workshop_id));
CREATE POLICY "members insert wamsg" ON public.whatsapp_mensagens FOR INSERT TO authenticated WITH CHECK (public.is_workshop_member(auth.uid(), workshop_id));
CREATE TRIGGER trg_wamsg_workshop BEFORE INSERT ON public.whatsapp_mensagens FOR EACH ROW EXECUTE FUNCTION public.set_workshop_id_default();
CREATE TRIGGER trg_wamsg_updated BEFORE UPDATE ON public.whatsapp_mensagens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ TRIGGERS: OS status change → automações ============
CREATE OR REPLACE FUNCTION public.os_on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente RECORD;
  v_veiculo RECORD;
  v_workshop RECORD;
  v_cfg RECORD;
  v_msg text;
  v_item RECORD;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_cliente FROM public.clientes WHERE id = NEW.cliente_id;
  SELECT * INTO v_veiculo FROM public.veiculos WHERE id = NEW.veiculo_id;
  SELECT * INTO v_workshop FROM public.workshops WHERE id = NEW.workshop_id;
  SELECT * INTO v_cfg FROM public.whatsapp_config WHERE workshop_id = NEW.workshop_id;

  -- Concluída: baixa estoque + lança receita + msg whatsapp
  IF NEW.status = 'concluida' AND OLD.status <> 'concluida' THEN
    IF NEW.data_conclusao IS NULL THEN
      NEW.data_conclusao := now();
    END IF;

    -- Baixa estoque das peças
    FOR v_item IN
      SELECT * FROM public.os_itens WHERE os_id = NEW.id AND tipo = 'peca' AND estoque_item_id IS NOT NULL
    LOOP
      INSERT INTO public.estoque_movimentacoes (workshop_id, item_id, tipo, quantidade, motivo, os_id)
      VALUES (NEW.workshop_id, v_item.estoque_item_id, 'saida', v_item.quantidade, 'OS #' || NEW.numero, NEW.id);
    END LOOP;

    -- Lança receita
    INSERT INTO public.financeiro_lancamentos (workshop_id, tipo, categoria, descricao, valor, data_vencimento, status, os_id, cliente_id)
    VALUES (NEW.workshop_id, 'receita', 'OS', 'OS #' || NEW.numero || ' - ' || COALESCE(v_cliente.nome,''), NEW.valor_total - NEW.desconto, CURRENT_DATE, 'pendente', NEW.id, NEW.cliente_id);

    -- Mensagem WhatsApp
    IF v_cfg.ativo AND v_cliente.telefone IS NOT NULL THEN
      v_msg := COALESCE(v_cfg.template_os_concluida, 'OS #{numero} concluída');
      v_msg := replace(v_msg, '{cliente}', COALESCE(v_cliente.nome,''));
      v_msg := replace(v_msg, '{numero}', NEW.numero::text);
      v_msg := replace(v_msg, '{valor}', to_char(NEW.valor_total - NEW.desconto, 'FM999G999G990D00'));
      v_msg := replace(v_msg, '{oficina}', COALESCE(v_workshop.name,''));
      v_msg := replace(v_msg, '{veiculo}', COALESCE(v_veiculo.marca,'') || ' ' || COALESCE(v_veiculo.modelo,''));
      v_msg := replace(v_msg, '{placa}', COALESCE(v_veiculo.placa,''));
      INSERT INTO public.whatsapp_mensagens (workshop_id, telefone, mensagem, evento, ref_tipo, ref_id)
      VALUES (NEW.workshop_id, v_cliente.telefone, v_msg, 'os_concluida', 'os', NEW.id);
    END IF;
  END IF;

  -- Entregue: msg de agradecimento
  IF NEW.status = 'entregue' AND OLD.status <> 'entregue' THEN
    IF NEW.data_entrega IS NULL THEN
      NEW.data_entrega := now();
    END IF;
    IF v_cfg.ativo AND v_cliente.telefone IS NOT NULL THEN
      v_msg := COALESCE(v_cfg.template_os_entregue, 'Obrigado!');
      v_msg := replace(v_msg, '{cliente}', COALESCE(v_cliente.nome,''));
      v_msg := replace(v_msg, '{numero}', NEW.numero::text);
      v_msg := replace(v_msg, '{oficina}', COALESCE(v_workshop.name,''));
      INSERT INTO public.whatsapp_mensagens (workshop_id, telefone, mensagem, evento, ref_tipo, ref_id)
      VALUES (NEW.workshop_id, v_cliente.telefone, v_msg, 'os_entregue', 'os', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_os_status_change BEFORE UPDATE ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION public.os_on_status_change();

-- ============ LOCK DOWN security definer helpers ============
REVOKE EXECUTE ON FUNCTION public.set_workshop_id_default() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.os_set_numero() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.estoque_aplicar_mov() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.troca_oleo_calc() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.os_on_status_change() FROM PUBLIC;
