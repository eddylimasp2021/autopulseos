-- Fix saas_contratos cross-workshop access
DROP POLICY IF EXISTS "Admins can view saas_contratos" ON public.saas_contratos;
DROP POLICY IF EXISTS "Admins can insert saas_contratos" ON public.saas_contratos;
DROP POLICY IF EXISTS "Admins can update saas_contratos" ON public.saas_contratos;
DROP POLICY IF EXISTS "Admins can delete saas_contratos" ON public.saas_contratos;

CREATE POLICY "Workshop admins view own saas_contratos"
ON public.saas_contratos FOR SELECT
USING (
  public.has_workshop_role(auth.uid(), workshop_id, 'owner'::workshop_role)
  OR public.has_workshop_role(auth.uid(), workshop_id, 'admin'::workshop_role)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Workshop admins insert own saas_contratos"
ON public.saas_contratos FOR INSERT
WITH CHECK (
  public.has_workshop_role(auth.uid(), workshop_id, 'owner'::workshop_role)
  OR public.has_workshop_role(auth.uid(), workshop_id, 'admin'::workshop_role)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Workshop admins update own saas_contratos"
ON public.saas_contratos FOR UPDATE
USING (
  public.has_workshop_role(auth.uid(), workshop_id, 'owner'::workshop_role)
  OR public.has_workshop_role(auth.uid(), workshop_id, 'admin'::workshop_role)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Workshop admins delete own saas_contratos"
ON public.saas_contratos FOR DELETE
USING (
  public.has_workshop_role(auth.uid(), workshop_id, 'owner'::workshop_role)
  OR public.has_workshop_role(auth.uid(), workshop_id, 'admin'::workshop_role)
  OR public.is_super_admin(auth.uid())
);

-- Add UPDATE/DELETE policies for estoque_movimentacoes (admins only, to prevent fraud)
CREATE POLICY "admins update estmov"
ON public.estoque_movimentacoes FOR UPDATE
USING (
  public.has_workshop_role(auth.uid(), workshop_id, 'owner'::workshop_role)
  OR public.has_workshop_role(auth.uid(), workshop_id, 'admin'::workshop_role)
);

CREATE POLICY "admins delete estmov"
ON public.estoque_movimentacoes FOR DELETE
USING (
  public.has_workshop_role(auth.uid(), workshop_id, 'owner'::workshop_role)
  OR public.has_workshop_role(auth.uid(), workshop_id, 'admin'::workshop_role)
);

-- Add UPDATE/DELETE for whatsapp_mensagens (members can manage their queue)
CREATE POLICY "members update wamsg"
ON public.whatsapp_mensagens FOR UPDATE
USING (public.is_workshop_member(auth.uid(), workshop_id));

CREATE POLICY "members delete wamsg"
ON public.whatsapp_mensagens FOR DELETE
USING (public.is_workshop_member(auth.uid(), workshop_id));

-- Fix function search_path mutable
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
