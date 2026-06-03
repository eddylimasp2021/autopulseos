create table if not exists public.saas_contratos (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  status text not null check (status in ('gerado', 'assinado', 'cancelado')),
  conteudo_html text not null,
  assinatura_imagem text,
  assinatura_ip text,
  data_assinatura timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Enable RLS
alter table public.saas_contratos enable row level security;

-- Only Admins can manage saas_contratos
-- Assuming there's a way to check if user is admin (like we did with saas_config)
create policy "Admins can view saas_contratos"
  on public.saas_contratos for select
  using (
    exists (
      select 1 from public.workshop_members wm
      where wm.user_id = auth.uid()
      and wm.role = 'admin'
    )
    or
    auth.uid() in (
      select user_id from public.workshop_members where role = 'admin'
    )
  );

create policy "Admins can insert saas_contratos"
  on public.saas_contratos for insert
  with check (
    exists (
      select 1 from public.workshop_members wm
      where wm.user_id = auth.uid()
      and wm.role = 'admin'
    )
  );

create policy "Admins can update saas_contratos"
  on public.saas_contratos for update
  using (
    exists (
      select 1 from public.workshop_members wm
      where wm.user_id = auth.uid()
      and wm.role = 'admin'
    )
  );

create policy "Admins can delete saas_contratos"
  on public.saas_contratos for delete
  using (
    exists (
      select 1 from public.workshop_members wm
      where wm.user_id = auth.uid()
      and wm.role = 'admin'
    )
  );

-- Trigger for updated_at
create trigger handle_updated_at before update on public.saas_contratos
  for each row execute procedure moddatetime (updated_at);
