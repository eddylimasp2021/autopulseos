-- Drop the check constraint on ordens_servico.elevador and recreate it allowing any number >= 1
ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_elevador_check;
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_elevador_check CHECK (elevador >= 1);

-- Add column quantidade_elevadores to workshops table
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS quantidade_elevadores integer NOT NULL DEFAULT 7;
