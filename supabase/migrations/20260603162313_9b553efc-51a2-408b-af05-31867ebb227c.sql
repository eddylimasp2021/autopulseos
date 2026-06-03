
-- Add support_enabled to workshops
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS support_enabled boolean NOT NULL DEFAULT false;

-- Create saas_config singleton table
CREATE TABLE IF NOT EXISTS public.saas_config (
  id integer PRIMARY KEY,
  asaas_api_key text,
  asaas_webhook_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saas_config_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_config TO authenticated;
GRANT ALL ON public.saas_config TO service_role;

ALTER TABLE public.saas_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admins read saas_config" ON public.saas_config;
CREATE POLICY "super admins read saas_config" ON public.saas_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super admins write saas_config" ON public.saas_config;
CREATE POLICY "super admins write saas_config" ON public.saas_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
