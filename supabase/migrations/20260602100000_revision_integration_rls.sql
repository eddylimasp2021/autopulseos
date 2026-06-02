-- Revisão de políticas RLS para tabelas de integração: whatsapp_config, whatsapp_mensagens, fiscal_config, fiscal_xmls

-- ============ WHATSAPP CONFIG ============
-- Remover políticas anteriores se existirem
DROP POLICY IF EXISTS "members view wa_config" ON public.whatsapp_config;
DROP POLICY IF EXISTS "admins view wa_config" ON public.whatsapp_config;
DROP POLICY IF EXISTS "admins insert wa_config" ON public.whatsapp_config;
DROP POLICY IF EXISTS "admins update wa_config" ON public.whatsapp_config;

-- Apenas owners e admins podem ver a configuração (incluindo URL da instância e token do WhatsApp)
CREATE POLICY "admins view wa_config" ON public.whatsapp_config
  FOR SELECT TO authenticated
  USING (
    public.has_workshop_role(auth.uid(), workshop_id, 'owner') 
    OR public.has_workshop_role(auth.uid(), workshop_id, 'admin')
  );

-- Apenas owners e admins podem inserir
CREATE POLICY "admins insert wa_config" ON public.whatsapp_config
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workshop_role(auth.uid(), workshop_id, 'owner') 
    OR public.has_workshop_role(auth.uid(), workshop_id, 'admin')
  );

-- Apenas owners e admins podem atualizar
CREATE POLICY "admins update wa_config" ON public.whatsapp_config
  FOR UPDATE TO authenticated
  USING (
    public.has_workshop_role(auth.uid(), workshop_id, 'owner') 
    OR public.has_workshop_role(auth.uid(), workshop_id, 'admin')
  );


-- ============ FISCAL CONFIG ============
-- Remover políticas anteriores se existirem
DROP POLICY IF EXISTS "members view fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "members insert fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "members update fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "members delete fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "admins view fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "admins insert fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "admins update fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "admins delete fiscal_config" ON public.fiscal_config;

-- Apenas owners e admins podem visualizar configurações fiscais (certificado digital, senha, tokens)
CREATE POLICY "admins view fiscal_config" ON public.fiscal_config
  FOR SELECT TO authenticated
  USING (
    public.has_workshop_role(auth.uid(), workshop_id, 'owner') 
    OR public.has_workshop_role(auth.uid(), workshop_id, 'admin')
  );

-- Apenas owners e admins podem inserir
CREATE POLICY "admins insert fiscal_config" ON public.fiscal_config
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workshop_role(auth.uid(), workshop_id, 'owner') 
    OR public.has_workshop_role(auth.uid(), workshop_id, 'admin')
  );

-- Apenas owners e admins podem atualizar
CREATE POLICY "admins update fiscal_config" ON public.fiscal_config
  FOR UPDATE TO authenticated
  USING (
    public.has_workshop_role(auth.uid(), workshop_id, 'owner') 
    OR public.has_workshop_role(auth.uid(), workshop_id, 'admin')
  );

-- Apenas owners e admins podem deletar
CREATE POLICY "admins delete fiscal_config" ON public.fiscal_config
  FOR DELETE TO authenticated
  USING (
    public.has_workshop_role(auth.uid(), workshop_id, 'owner') 
    OR public.has_workshop_role(auth.uid(), workshop_id, 'admin')
  );


-- ============ FISCAL XMLS ============
-- Remover políticas anteriores se existirem
DROP POLICY IF EXISTS "members view fiscal_xmls" ON public.fiscal_xmls;
DROP POLICY IF EXISTS "members insert fiscal_xmls" ON public.fiscal_xmls;
DROP POLICY IF EXISTS "members update fiscal_xmls" ON public.fiscal_xmls;
DROP POLICY IF EXISTS "members delete fiscal_xmls" ON public.fiscal_xmls;
DROP POLICY IF EXISTS "admins insert fiscal_xmls" ON public.fiscal_xmls;
DROP POLICY IF EXISTS "admins update fiscal_xmls" ON public.fiscal_xmls;
DROP POLICY IF EXISTS "admins delete fiscal_xmls" ON public.fiscal_xmls;

-- Qualquer membro da oficina pode ver os XMLs emitidos ou importados (ex: para listagem e auditoria geral)
CREATE POLICY "members view fiscal_xmls" ON public.fiscal_xmls
  FOR SELECT TO authenticated
  USING (public.is_workshop_member(auth.uid(), workshop_id));

-- Apenas owners e admins podem gerenciar (inserir, atualizar, deletar) XMLs fiscais
CREATE POLICY "admins insert fiscal_xmls" ON public.fiscal_xmls
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workshop_role(auth.uid(), workshop_id, 'owner') 
    OR public.has_workshop_role(auth.uid(), workshop_id, 'admin')
  );

CREATE POLICY "admins update fiscal_xmls" ON public.fiscal_xmls
  FOR UPDATE TO authenticated
  USING (
    public.has_workshop_role(auth.uid(), workshop_id, 'owner') 
    OR public.has_workshop_role(auth.uid(), workshop_id, 'admin')
  );

CREATE POLICY "admins delete fiscal_xmls" ON public.fiscal_xmls
  FOR DELETE TO authenticated
  USING (
    public.has_workshop_role(auth.uid(), workshop_id, 'owner') 
    OR public.has_workshop_role(auth.uid(), workshop_id, 'admin')
  );
