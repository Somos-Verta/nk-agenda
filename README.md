# NK Agenda

Agenda de baterias do kartódromo Nacional Kart (Goiânia, Penha, Osasco e Morumbi), para as atendentes
verem rápido se cabe um grupo num horário e reservar sem estourar a capacidade.

- **Sellflux é a fonte de verdade dos agendamentos.** Cada unidade é um usuário da Sellflux
  ("Recepção - Goiânia" etc.); a agenda desse usuário é a agenda de karts da unidade.
- **Capacidade e horários são deste app** — a Sellflux não tem esse conceito. Ficam na tabela
  `nk_unidades` (Supabase) e são editados na tela **Configuração**.
- Uma reserva = um agendamento na Sellflux com título `Nome Np` e descrição padronizada, vinculado ao
  lead (criado/atualizado pelo telefone, com o campo `quantidade_de_participantes_ultimo`).

Stack: Next.js 16 (App Router) · shadcn/ui · Supabase · Vercel.

## Rodando

```bash
pnpm install
cp .env.example .env.local   # e preencha
pnpm dev
```

| Variável | O que é |
|---|---|
| `SELLFLUX_TOKEN` | Chave de API do projeto Sellflux. Só é lida no servidor. |
| `APP_PASSWORD` | Senha compartilhada das atendentes (tela de login). |
| `SESSION_SECRET` | String aleatória longa que assina o cookie de sessão (`openssl rand -hex 32`). |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Projeto Supabase com a tabela `nk_unidades`. Service role, só no servidor. |

Primeiro acesso: entre em **Configuração** e ligue cada unidade ao seu usuário "Recepção" da Sellflux;
ajuste capacidade (karts por bateria) e horários por dia da semana.

```bash
pnpm test        # parse/slots/tz
pnpm typecheck
pnpm lint
```

## Como funciona

```
tela /agenda ──> GET /api/agenda?unidade&data ──> Sellflux GET /crm/schedules (usuário da unidade)
                                                  + nk_unidades (capacidade, grade)
                                                  = slots de 30 min com ocupação e vagas

Nova reserva ──> POST /api/agenda ──> recalcula vagas no servidor
                                      ├─ 409 lotado (+ alternativas com vaga)
                                      ├─ lead: busca por telefone → cria ou atualiza
                                      └─ POST /crm/schedules (subject "Nome Np", description padrão)
Editar ──────> PUT /api/agenda/:id     (re-checa vaga ignorando a própria reserva)
Cancelar ────> DELETE /api/agenda/:id  (PUT status=2; fallback: prefixo "CANCELADO - ")
```

- Ocupação de um slot = soma das pessoas dos agendamentos ativos que começam nele. A quantidade vem do
  título (`9p`) ou da linha "Quantidade de participantes" da descrição. Agendamento fora do padrão
  (criado à mão na Sellflux) conta como **1** e aparece com aviso.
- Agendamentos canceladas não ocupam e aparecem riscados.
- O token da Sellflux e a service role do Supabase nunca chegam ao browser: só os route handlers os leem.
- Cookie de sessão HMAC (`proxy.ts` bloqueia tudo sem ele; APIs devolvem 401).

Referência da API Sellflux: [SELLFLUX-API.md](SELLFLUX-API.md). Versão anterior (HTML único, sem
backend): `legacy/agenda-nacional-kart.html`.

## Estrutura

```
app/agenda            grade do dia, filtro "quantas pessoas?", nova reserva, editar/cancelar
app/configuracao      capacidade, duração, horários e usuário Sellflux por unidade
app/api/agenda        GET grade · POST cria · PUT/DELETE em [id]
app/api/config        GET/PUT nk_unidades
app/api/sellflux/users lista usuários para o mapeamento
lib/agenda.ts         regras (vaga, 409, lead, textos)
lib/sellflux.ts       cliente da API pública (normaliza os shapes de /crm/*)
lib/db.ts             único ponto de acesso ao banco
lib/slots.ts          grade e ocupação   ·   lib/parse.ts  título/descrição/telefone   ·   lib/tz.ts  fuso
supabase/migrations   SQL da tabela nk_unidades
```
