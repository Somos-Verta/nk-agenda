-- NK Agenda: configuração das unidades do kartódromo (capacidade, horários, usuário Sellflux).
-- Aplicada no projeto Supabase iuqccawxtrooqzbdskpk (N8N - RevLab) em 14/09/2026 via MCP.
-- Acesso exclusivo pela service role (servidor Next.js). RLS ativo sem policies bloqueia anon/authenticated.

create table public.nk_unidades (
  slug             text primary key check (slug ~ '^[a-z0-9_-]+$'),
  nome             text not null,
  sellflux_user_id integer,
  capacidade       integer not null default 12 check (capacidade > 0),
  duracao_min      integer not null default 30 check (duracao_min > 0),
  horarios         jsonb not null default '{}'::jsonb check (jsonb_typeof(horarios) = 'object'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.nk_unidades is 'NK Agenda (Nacional Kart): config por unidade. horarios = {"0":[{"inicio":"10:00","fim":"22:00"}],...} por dia da semana (0=domingo), [] = fechado.';

alter table public.nk_unidades enable row level security;

create or replace function public.nk_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger nk_unidades_set_updated_at
  before update on public.nk_unidades
  for each row execute function public.nk_set_updated_at();

insert into public.nk_unidades (slug, nome, horarios)
select slug, nome,
  '{"0":[{"inicio":"10:00","fim":"22:00"}],"1":[{"inicio":"10:00","fim":"22:00"}],"2":[{"inicio":"10:00","fim":"22:00"}],"3":[{"inicio":"10:00","fim":"22:00"}],"4":[{"inicio":"10:00","fim":"22:00"}],"5":[{"inicio":"10:00","fim":"22:00"}],"6":[{"inicio":"10:00","fim":"22:00"}]}'::jsonb
from (values
  ('goiania', 'Goiânia'),
  ('penha',   'Penha'),
  ('osasco',  'Osasco'),
  ('morumbi', 'Morumbi')
) as v(slug, nome)
on conflict (slug) do nothing;
