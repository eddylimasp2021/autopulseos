-- Add elevador column to ordens_servico
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS elevador integer CHECK (elevador >= 1 AND elevador <= 7);
