
GRANT EXECUTE ON FUNCTION public.is_workshop_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workshop_role(uuid, uuid, public.workshop_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_workshop_id_from_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_ws uuid;
BEGIN
  IF NEW.workshop_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT workshop_id, count(*) OVER () INTO v_ws, v_count
    FROM public.workshop_members
    WHERE user_id = auth.uid()
    LIMIT 1;
  IF v_count = 1 THEN
    NEW.workshop_id := v_ws;
  ELSIF v_count IS NULL THEN
    RAISE EXCEPTION 'User has no workshop membership';
  ELSE
    RAISE EXCEPTION 'User belongs to multiple workshops; workshop_id must be provided';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['clientes','veiculos','ordens_servico','os_itens','troca_oleo','estoque_itens','estoque_movimentacoes','financeiro_lancamentos','whatsapp_mensagens','whatsapp_config'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_workshop_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_workshop_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_workshop_id_from_membership()', t);
  END LOOP;
END $$;
