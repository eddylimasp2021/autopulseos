create table if not exists public.pdv_vendas (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  caixa_id uuid references public.pdv_caixas(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  operador_nome text not null,
  subtotal numeric not null,
  desconto numeric not null,
  total numeric not null,
  troco numeric not null,
  itens jsonb not null,
  pagamentos jsonb not null,
  observacao text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Habilitar RLS
alter table public.pdv_vendas enable row level security;

-- Permissões para usuários autenticados verem apenas vendas da sua oficina
create policy "Users can view own workshop pdv vendas"
  on public.pdv_vendas for select
  using (
    workshop_id in (
      select workshop_id from public.workshop_members 
      where user_id = auth.uid()
    )
  );

create policy "Users can insert own workshop pdv vendas"
  on public.pdv_vendas for insert
  with check (
    workshop_id in (
      select workshop_id from public.workshop_members 
      where user_id = auth.uid()
    )
  );

create policy "Users can update own workshop pdv vendas"
  on public.pdv_vendas for update
  using (
    workshop_id in (
      select workshop_id from public.workshop_members 
      where user_id = auth.uid()
    )
  );

create policy "Users can delete own workshop pdv vendas"
  on public.pdv_vendas for delete
  using (
    workshop_id in (
      select workshop_id from public.workshop_members 
      where user_id = auth.uid()
    )
  );

-- Criar a função de atualizar a data caso não exista (reutilizando a que fizemos no contrato)
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Criar o gatilho (Trigger) para rodar a função
DROP TRIGGER IF EXISTS handle_pdv_vendas_updated_at ON public.pdv_vendas;
CREATE TRIGGER handle_pdv_vendas_updated_at
  BEFORE UPDATE ON public.pdv_vendas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Gatilho para preencher workshop_id automaticamente
CREATE TRIGGER trg_set_workshop_id BEFORE INSERT ON public.pdv_vendas FOR EACH ROW EXECUTE FUNCTION public.set_workshop_id_from_membership();
