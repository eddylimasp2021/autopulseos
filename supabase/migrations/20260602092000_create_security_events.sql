-- Criar tabela de eventos de segurança e logs do sistema
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workshop_id uuid REFERENCES public.workshops(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Ativar RLS para segurança
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Remover políticas se existirem para evitar conflitos na reexecução
DROP POLICY IF EXISTS "Membros owners/admins podem ler logs de seguranca" ON public.security_events;
DROP POLICY IF EXISTS "Membros podem inserir logs de seguranca" ON public.security_events;

-- Políticas de RLS para security_events
-- Apenas owners/admins membros do workshop podem ver logs
CREATE POLICY "Membros owners/admins podem ler logs de seguranca" ON public.security_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workshop_members m
      WHERE m.workshop_id = security_events.workshop_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- Permitir inserções de membros do workshop (para logs de auditoria e tentativas negadas)
CREATE POLICY "Membros podem inserir logs de seguranca" ON public.security_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workshop_members m
      WHERE m.workshop_id = security_events.workshop_id
        AND m.user_id = auth.uid()
    )
  );

-- Comentários explicativos da tabela
COMMENT ON TABLE public.security_events IS 'Registro de eventos de segurança, auditoria e acessos bloqueados';
COMMENT ON COLUMN public.security_events.event_type IS 'Tipo de evento de segurança (ex: whatsapp_unauthorized_access, whatsapp_config_changed)';
COMMENT ON COLUMN public.security_events.severity IS 'Nível de severidade do log (info, warning, critical)';
