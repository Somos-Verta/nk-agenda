# NK Agenda

Agenda de baterias do kartódromo Nacional Kart (Goiânia, Penha, Osasco e Morumbi), para as atendentes
verem rápido se cabe um grupo num horário e reservar sem estourar a capacidade.

- **Sellflux é a fonte de verdade dos agendamentos.** Cada unidade é um usuário da Sellflux
  ("Recepção - Goiânia" etc.); a agenda desse usuário é a agenda de karts da unidade.
- **Capacidade, horários e preço por pessoa são deste app** — a Sellflux não tem esse conceito. Ficam na tabela
  `nk_unidades` (Supabase) e são editados na tela **Configuração**. O preço (R$ por pessoa por bateria) é a base da
  previsão de faturamento.
- Uma reserva = um agendamento na Sellflux com título `Nome Np` e descrição padronizada, vinculado ao lead
  (criado/atualizado pelo telefone, com o campo `quantidade_de_participantes_ultimo`). A descrição pode ser
  editada como texto livre na ficha (inclusive a de agendamentos criados na Sellflux); ao mudar nome, pessoas,
  telefone ou bateria, o app reescreve só a linha padrão correspondente e preserva o resto.

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

- Telefone: máscara `(62) 98765-4321` no formulário e validação estrita (DDD existente, 9º dígito, tamanho,
  sem sequências) no cliente e no servidor (`validarTelefone`); gravado em E.164 no lead e na descrição.
- Ocupação de um slot = soma das pessoas dos agendamentos ativos que começam nele. A quantidade vem do
  título (`9p`) ou da linha "Quantidade de participantes" da descrição. Agendamento fora do padrão
  (criado à mão na Sellflux) conta como **1** e aparece com aviso.
- Agendamentos canceladas não ocupam e aparecem riscados.
- O token da Sellflux e a service role do Supabase nunca chegam ao browser: só os route handlers os leem.
- Cookie de sessão HMAC (`proxy.ts` bloqueia tudo sem ele; APIs devolvem 401).

Referência da API Sellflux: [SELLFLUX-API.md](SELLFLUX-API.md). Versão anterior (HTML único, sem
backend): `legacy/agenda-nacional-kart.html`.

## Marca

Cores da Nacional Kart: **#003399** (topbar) e **#011d4c** (botões, abas ativas, karts ocupados) — tokens `--brand` e
`--ink` em `app/globals.css`. A linha "agora"/"em pista" é vermelha (`--agora`), como a hora atual do Google Agenda. Imagens em `public/`: `logo.png` (logo completo, tela de login) e
`marca.png` (piloto, topbar); favicon/ícones em `app/`. Todas com fundo #003399, para usar sobre superfícies dessa cor.

## Tela da agenda

- Lista no estilo "Agenda" do Google Calendar: horário da bateria na margem e, ao lado, o **número de vagas**
  dentro de um anel segmentado (1 traço = 1 kart; os coloridos estão reservados — verde com folga, âmbar com
  menos da metade livre, vermelho lotada; `+N` quando há mais pessoas que karts). Abaixo, uma linha por reserva
  com ícone/cor de status iguais à legenda da Sellflux.
- Hoje: linha "agora" (a tela abre nela), bateria "em pista"; baterias que já passaram ficam esmaecidas.
  Reservar (ou mover) para bateria/data que já passou pede confirmação.
- Avisos no topo: baterias com mais pessoas que karts e agendamentos fora da grade de horários.
- Botão "Regras" explica o cálculo (cancelada não ocupa; não compareceu/concluída continuam ocupando…).
- Uma rota por unidade no menu (`/agenda/goiania?d=2026-09-14`); a data fica na query.

## Estrutura

```
app/agenda/[unidade]  quadro do dia, nova reserva, editar/cancelar  ·  app/agenda redireciona para a primeira unidade
app/configuracao      capacidade, duração, horários (com preview das baterias geradas), preço por pessoa e usuário Sellflux
app/api/agenda        GET grade · POST cria · PUT/DELETE em [id] · GET [id]/vinculos (lead e chat na Sellflux)
app/api/config        GET/PUT nk_unidades
app/api/sellflux/users lista usuários para o mapeamento
lib/agenda.ts         regras (vaga, 409, lead, textos)
lib/sellflux.ts       cliente da API pública (normaliza os shapes de /crm/*)
lib/db.ts             único ponto de acesso ao banco
lib/slots.ts          grade e ocupação   ·   lib/parse.ts  título/descrição/telefone   ·   lib/tz.ts  fuso
components/agenda     SlotRow (bloco da bateria + linhas de reserva) · RingVagas (anel de vagas) · status (ícones/cores) · HorarioPicker · PessoasStepper · RegrasDialog
supabase/migrations   SQL da tabela nk_unidades
```
