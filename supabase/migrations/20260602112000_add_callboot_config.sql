-- Adiciona colunas para configuração da API Callboot na tabela whatsapp_config
ALTER TABLE public.whatsapp_config
ADD COLUMN callboot_ativo boolean NOT NULL DEFAULT false,
ADD COLUMN callboot_instance_url text,
ADD COLUMN callboot_token text,
ADD COLUMN callboot_template_os_concluida text DEFAULT 'Olá {cliente}, sua OS #{numero} foi concluída! Valor: R$ {valor}. Pode retirar seu veículo. - {oficina}',
ADD COLUMN callboot_template_os_entregue text DEFAULT 'Olá {cliente}, obrigado pela confiança! Esperamos vê-lo novamente. - {oficina}',
ADD COLUMN callboot_template_lembrete_oleo text DEFAULT 'Olá {cliente}, está chegando a data da próxima troca de óleo do seu {veiculo} ({placa}). Agende com a gente! - {oficina}',
ADD COLUMN callboot_template_cobranca text DEFAULT 'Olá {cliente}, lembrete: você tem um pagamento de R$ {valor} com vencimento em {data}. - {oficina}';

-- Adiciona coluna provedor na tabela whatsapp_mensagens para diferenciar os envios
ALTER TABLE public.whatsapp_mensagens
ADD COLUMN provedor text NOT NULL DEFAULT 'uazapi';

-- Atualiza a função de trigger para suportar envios em ambos os provedores (ou no que estiver ativo)
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

    -- Mensagem WhatsApp UAZAPI
    IF v_cfg.ativo AND v_cliente.telefone IS NOT NULL THEN
      v_msg := COALESCE(v_cfg.template_os_concluida, 'Olá {cliente}, sua OS #{numero} foi concluída! Valor: R$ {valor}. Pode retirar seu veículo. - {oficina}');
      v_msg := replace(v_msg, '{cliente}', COALESCE(v_cliente.nome,''));
      v_msg := replace(v_msg, '{numero}', NEW.numero::text);
      v_msg := replace(v_msg, '{valor}', to_char(NEW.valor_total - NEW.desconto, 'FM999G999G990D00'));
      v_msg := replace(v_msg, '{oficina}', COALESCE(v_workshop.name,''));
      v_msg := replace(v_msg, '{veiculo}', COALESCE(v_veiculo.marca,'') || ' ' || COALESCE(v_veiculo.modelo,''));
      v_msg := replace(v_msg, '{placa}', COALESCE(v_veiculo.placa,''));
      INSERT INTO public.whatsapp_mensagens (workshop_id, telefone, mensagem, evento, ref_tipo, ref_id, provedor)
      VALUES (NEW.workshop_id, v_cliente.telefone, v_msg, 'os_concluida', 'os', NEW.id, 'uazapi');
    END IF;

    -- Mensagem WhatsApp Callboot
    IF v_cfg.callboot_ativo AND v_cliente.telefone IS NOT NULL THEN
      v_msg := COALESCE(v_cfg.callboot_template_os_concluida, 'Olá {cliente}, sua OS #{numero} foi concluída! Valor: R$ {valor}. Pode retirar seu veículo. - {oficina}');
      v_msg := replace(v_msg, '{cliente}', COALESCE(v_cliente.nome,''));
      v_msg := replace(v_msg, '{numero}', NEW.numero::text);
      v_msg := replace(v_msg, '{valor}', to_char(NEW.valor_total - NEW.desconto, 'FM999G999G990D00'));
      v_msg := replace(v_msg, '{oficina}', COALESCE(v_workshop.name,''));
      v_msg := replace(v_msg, '{veiculo}', COALESCE(v_veiculo.marca,'') || ' ' || COALESCE(v_veiculo.modelo,''));
      v_msg := replace(v_msg, '{placa}', COALESCE(v_veiculo.placa,''));
      INSERT INTO public.whatsapp_mensagens (workshop_id, telefone, mensagem, evento, ref_tipo, ref_id, provedor)
      VALUES (NEW.workshop_id, v_cliente.telefone, v_msg, 'os_concluida', 'os', NEW.id, 'callboot');
    END IF;
  END IF;

  -- Entregue: msg de agradecimento
  IF NEW.status = 'entregue' AND OLD.status <> 'entregue' THEN
    IF NEW.data_entrega IS NULL THEN
      NEW.data_entrega := now();
    END IF;

    -- Mensagem UAZAPI
    IF v_cfg.ativo AND v_cliente.telefone IS NOT NULL THEN
      v_msg := COALESCE(v_cfg.template_os_entregue, 'Olá {cliente}, obrigado pela confiança! Esperamos vê-lo novamente. - {oficina}');
      v_msg := replace(v_msg, '{cliente}', COALESCE(v_cliente.nome,''));
      v_msg := replace(v_msg, '{numero}', NEW.numero::text);
      v_msg := replace(v_msg, '{oficina}', COALESCE(v_workshop.name,''));
      INSERT INTO public.whatsapp_mensagens (workshop_id, telefone, mensagem, evento, ref_tipo, ref_id, provedor)
      VALUES (NEW.workshop_id, v_cliente.telefone, v_msg, 'os_entregue', 'os', NEW.id, 'uazapi');
    END IF;

    -- Mensagem Callboot
    IF v_cfg.callboot_ativo AND v_cliente.telefone IS NOT NULL THEN
      v_msg := COALESCE(v_cfg.callboot_template_os_entregue, 'Olá {cliente}, obrigado pela confiança! Esperamos vê-lo novamente. - {oficina}');
      v_msg := replace(v_msg, '{cliente}', COALESCE(v_cliente.nome,''));
      v_msg := replace(v_msg, '{numero}', NEW.numero::text);
      v_msg := replace(v_msg, '{oficina}', COALESCE(v_workshop.name,''));
      INSERT INTO public.whatsapp_mensagens (workshop_id, telefone, mensagem, evento, ref_tipo, ref_id, provedor)
      VALUES (NEW.workshop_id, v_cliente.telefone, v_msg, 'os_entregue', 'os', NEW.id, 'callboot');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
