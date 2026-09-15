-- NK Agenda: preço por pessoa (R$, por bateria) em cada unidade — base para a previsão de faturamento.
-- Aplicada no projeto Supabase iuqccawxtrooqzbdskpk (N8N - RevLab) em 15/09/2026 via MCP.
-- null = ainda não configurado (a tela pede para preencher); 0 é permitido (cortesia/evento).

alter table public.nk_unidades
  add column if not exists preco_pessoa numeric(10, 2)
  check (preco_pessoa is null or preco_pessoa >= 0);

comment on column public.nk_unidades.preco_pessoa is 'Preço por pessoa por bateria, em reais. null = não configurado.';
