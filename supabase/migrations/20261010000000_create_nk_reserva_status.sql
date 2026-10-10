-- NK Agenda: registro do status ("Andamento") das reservas.
-- A API pública da Sellflux só grava Agendada, Concluído e Cancelado (testado 10/10/2026); Reagendado,
-- Não compareceu e Nenhum não têm como ser gravados lá. Esta tabela guarda o status completo escolhido no app.
-- Aposentar quando a API aceitar os 6 status: empurrar os registros para a Sellflux e dropar a tabela
-- (procedimento no README, "Status das reservas").
-- Acesso exclusivo pela service role (servidor Next.js). RLS ativo sem policies bloqueia anon/authenticated.

create table public.nk_reserva_status (
  schedule_id bigint primary key,
  data        date not null,
  status      text not null check (status in ('nenhum', 'agendado', 'concluido', 'reagendado', 'nao_compareceu', 'cancelado')),
  base_status text not null check (base_status in ('nenhum', 'agendado', 'concluido', 'reagendado', 'nao_compareceu', 'cancelado')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.nk_reserva_status is 'NK Agenda: status escolhido no app para um agendamento da Sellflux (schedule_id). base_status = status que a Sellflux mostrava quando o registro foi gravado; se a Sellflux mudar depois, ela manda e o registro é ignorado.';
comment on column public.nk_reserva_status.data is 'Dia da reserva (fuso das unidades) — a grade lê o registro do dia numa só consulta.';

create index nk_reserva_status_data_idx on public.nk_reserva_status (data);

alter table public.nk_reserva_status enable row level security;

create trigger nk_reserva_status_set_updated_at
  before update on public.nk_reserva_status
  for each row execute function public.nk_set_updated_at();
