-- Re-scope estoque_movimentacoes policies to authenticated
DROP POLICY IF EXISTS "admins update estmov" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "admins delete estmov" ON public.estoque_movimentacoes;

CREATE POLICY "admins update estmov" ON public.estoque_movimentacoes
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_workshop_role(auth.uid(), workshop_id, 'owner') OR public.has_workshop_role(auth.uid(), workshop_id, 'admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_workshop_role(auth.uid(), workshop_id, 'owner') OR public.has_workshop_role(auth.uid(), workshop_id, 'admin'));

CREATE POLICY "admins delete estmov" ON public.estoque_movimentacoes
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_workshop_role(auth.uid(), workshop_id, 'owner') OR public.has_workshop_role(auth.uid(), workshop_id, 'admin'));

-- Re-scope whatsapp_mensagens policies to authenticated
DROP POLICY IF EXISTS "members update wamsg" ON public.whatsapp_mensagens;
DROP POLICY IF EXISTS "members delete wamsg" ON public.whatsapp_mensagens;

CREATE POLICY "members update wamsg" ON public.whatsapp_mensagens
  FOR UPDATE TO authenticated
  USING (public.is_workshop_member(auth.uid(), workshop_id))
  WITH CHECK (public.is_workshop_member(auth.uid(), workshop_id));

CREATE POLICY "members delete wamsg" ON public.whatsapp_mensagens
  FOR DELETE TO authenticated
  USING (public.is_workshop_member(auth.uid(), workshop_id));

-- Harden user_roles INSERT/UPDATE/DELETE: ensure they target authenticated and are gated by is_super_admin
DROP POLICY IF EXISTS "Super admins manage roles - insert" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins manage roles - update" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins manage roles - delete" ON public.user_roles;

CREATE POLICY "Super admins manage roles - insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins manage roles - update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins manage roles - delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));