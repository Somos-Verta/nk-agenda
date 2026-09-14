# Integração Sellflux — referência

Levantado da documentação oficial (https://developers.sellflux.com) em 16/07/2026.
Este arquivo é a fonte de verdade da integração. O que está aqui foi lido da doc, não inferido.

## Conclusão que define a arquitetura

**A Sellflux tem agenda, mas não tem capacidade.** O recurso `/api/v1/crm/schedules` é um
calendário de compromissos (`subject`, `start_date`, `end_date`, participantes) — não existe
nenhum campo de vaga, lotação ou recurso limitado. Ela não sabe que uma bateria tem 10 karts
e não tem como recusar o 11º piloto.

Logo:

- **A Agenda Nacional Kart é a fonte de verdade** das baterias, da capacidade e do encaixe.
  Essa lógica não pode migrar para a Sellflux — ela não comporta.
- **A Sellflux é a camada de CRM e comunicação**: lead, histórico, WhatsApp, automação.
- O sentido natural do fluxo é **Agenda → Sellflux**: reservou aqui, reflete lá como
  compromisso vinculado ao lead. O caminho inverso (Sellflux cria reserva) precisa passar
  pela nossa API, que é quem valida vaga.

## Autenticação

Header em todas as rotas: `Authorization: Bearer <token>`.

⚠️ **`acting_user_id` é obrigatório em todas as rotas de CRM quando a autenticação é por chave
de API** (o nosso caso). É o ID de um usuário do projeto. Descobrir em
`GET /api/v1/crm/team/users`, que a própria doc indica como a rota para "descobrir ids válidos
para acting_user_id".

Níveis de permissão de membro: `1` Administrador · `2` SAC + SellFlux · `3` SellFlux · `4` SAC.

## Bases

| Base | Uso |
|---|---|
| `https://apis.sellflux.app/api/v1` | REST principal (leads, CRM, equipe) |
| `https://apis.sellflux.app/api/v1/flux-v2` | Automações (builder atual) |
| `https://apis.sellflux.app/automation/v1` | Disparos de WhatsApp e e-mail |

## Agendamentos — `/api/v1/crm/schedules`

> "Agendamentos/compromissos com vínculo opcional a entidades."

### POST /api/v1/crm/schedules

| Campo | Obrig. | Descrição |
|---|---|---|
| `subject` | Sim | Título/assunto do compromisso |
| `description` | Não | Descrição livre |
| `start_date` | Sim | Início, ISO 8601 |
| `end_date` | Sim | Término, ISO 8601 |
| `timezone` | Não | Fuso IANA (`America/Sao_Paulo`) |
| `schedule_type` | Não | **Só aceita**: `meeting` · `call` · `task` · `email` |
| `participant_user_ids` | Não | IDs separados por vírgula (`"1,2,3"`) |
| `lead_ids` | Não | IDs de leads relacionados, separados por vírgula |
| `entity_type` | Não | `ticket` ou `deal`/`card` |
| `entity_id` | Não | ID da entidade vinculada |
| `acting_user_id` | Condicional | **Obrigatório com chave de API** |

Não existe `schedule_type` de reserva/kart — uma bateria é mapeada como `meeting`.

### GET /api/v1/crm/schedules

Query: `page`, `limit`, `search` (busca no assunto e descrição), `status`,
`only_my_participation`, `start_date`, `end_date`, `acting_user_id`.

`status`: **`1` = agendado · `2` = concluído**. Omitido retorna todos os ativos.

### Outras

- `GET /api/v1/crm/schedules/:id`
- `PUT /api/v1/crm/schedules/:id` — atualizar
- `GET /api/v1/crm/schedules/:id/links` — vínculos com outras entidades

## Leads — `/api/v1/lead`

> "Um lead é um contato (pessoa) com nome, e-mail, telefone, tags e campos personalizados."

### POST /api/v1/lead → `201 Created` com `{ "id": 100025 }`

| Campo | Obrig. | Tipo |
|---|---|---|
| `name` | Não | string |
| `email` | Não | string |
| `phone` | Não | string, preferencialmente com DDI |
| `tags` | Não | array(string) |

**Campos personalizados:** qualquer chave extra no body que corresponda a um campo
personalizado cadastrado no projeto é armazenada automaticamente no perfil do lead.
É assim que `bateria`, `unidade` e `pessoas` vão para o lead — **mas os campos precisam
existir antes no projeto Sellflux**, senão a chave é ignorada silenciosamente.

### Demais

- `GET /api/v1/lead/project?page=1&search=` — lista paginada; `search` busca por **nome,
  e-mail ou telefone**. É como achamos um lead existente antes de criar duplicado.
  Retorna `id`, `name`, `email`, `phone`, `tags`, `status`, `code`, `unsub_sms`,
  `unsub_whats`, `unsub_call`, timestamps.
- `GET /api/v1/lead/:id` — lead completo com campos personalizados
- `PUT /api/v1/lead` — ⚠️ **o `id` vai no body, não no path**
- `DELETE /api/v1/lead/:id` — remoção lógica (`status = 3`); histórico é preservado

## WhatsApp — `/automation/v1`

| Rota | Body | Uso |
|---|---|---|
| `POST /whatsapp/lead` | `{lead_id, template_id, data}` | Manda para o telefone primário do lead |
| `POST /whatsapp/phone` | `{phone, template_id, data}` | Número avulso, `+5511999999999` |
| `POST /whatsapp/data` | `{ref_type:"whatsapp", ...}` | Dispara para o público do template |

`data` carrega as variáveis dinâmicas do template. É por aqui que sai a confirmação da
bateria e o lembrete.

## Equipe — `/api/v1/crm/team/users`

`GET /api/v1/crm/team/users?page=1&limit=30&search=` — lista os usuários do projeto.
Necessário para obter o `acting_user_id`.

## Automações — `/api/v1/flux-v2`

`domain_type` de uma campanha aceita: `lead` · `transaction` · `card` · `ticket` ·
`attendance` · `email` · **`schedule`** · `task`.

Ou seja, dá para construir uma automação disparada por **agendamento** — é o gancho para
lembrete de bateria e follow-up de no-show, sem a gente precisar agendar nada do nosso lado.

## Restrições que valem lembrar

1. **Token no browser é inviável.** A chave da Sellflux dá acesso ao CRM inteiro do projeto.
   Se ela ficar no HTML/localStorage, qualquer pessoa que abrir a página lê a chave. Além
   disso o browser bate em CORS. A integração **tem que sair do backend** — o painel fala com
   a nossa API, e a nossa API fala com a Sellflux.
2. **Sem capacidade na Sellflux** (ver topo). O encaixe é nosso.
3. **Campos personalizados** precisam ser criados no projeto Sellflux antes de serem enviados.
4. **`acting_user_id`** obrigatório nas rotas de CRM com chave de API.
5. `PUT /api/v1/lead` com id no body foge do padrão REST das outras rotas.

---

## Descobertas com o token real (14/09/2026, projeto 36486)

Nada disto está na doc. Verificado por chamadas reais.

### Chave de API (`permission: "api"`)

- ✅ `/api/v1/lead/*` funciona direto.
- ✅ `/api/v1/crm/schedules` funciona **só com `acting_user_id` de um usuário com permissão de CRM**
  (Administrador). Usuários "Recepção" (permissão 2) e outros dão
  `"acting_user_id não tem permissão para esta ação no projeto"`.
  → O app usa `SELLFLUX_ACTING_USER_ID` (admin) nas chamadas e coloca o usuário da unidade em
  `participant_user_ids`, que é o que faz o compromisso aparecer na agenda dele.
- ❌ `/api/v1/crm/team/users`, `/api/v1/team/project`, `/api/v1/project`, `/flux-v2/aux/team-users`:
  `"Chave não encontrada"` — a chave não tem escopo de equipe. Os ids dos usuários foram obtidos pela UI
  (Equipe) e ficam em `nk_unidades.sellflux_user_id`.

### GET /api/v1/crm/schedules — shape real

```json
{ "data": [ {
    "id": 200000001, "subject": "Beltrana Silva 2p ❌",
    "description": "🏎️ Reservado por: ...\n📆 Data: 20/12\n⏱ Horário: 16h\n📲 Telefone: ...\n🙋‍♂️ Quantidade de participantes: 2",
    "status": 1, "start_date": "2026-12-20T19:00:00.000Z", "end_date": "2026-12-20T19:30:00.000Z",
    "timezone": "America/Sao_Paulo", "schedule_type": 1,
    "lead_id": null, "lead_ids": [100000001],
    "users": [56445, 56938], "action_user_id": 56938,
    "task_completed": false, "priority": 1, "created_at": "...", "updated_at": "..."
} ], "total": 4439, "page": 1, "limit": 3, "total_pages": 1480 }
```

- `start_date`/`end_date` em **UTC** (16h de Brasília = `19:00Z`).
- `users` = participantes (ids de usuário). A agenda de uma unidade = itens cujo `users` contém o
  usuário "Recepção" dela.
- **`start_date`/`end_date` como filtro são ignorados** — testado com ISO, `YYYY-MM-DD`, `DD/MM/YYYY`,
  `startDate`, `from/to`, `date`… todos devolvem os 4.439. `search` filtra texto em subject/description.
- A lista vem **ordenada por `start_date` desc** (verificado em 1.000 itens) e `limit` aceita até 5.000.
  → O app pagina (300 por página) e para quando passa do dia pedido; para hoje é 1 requisição, porque só
  os agendamentos futuros (~100) vêm antes.
- `only_my_participation=true` filtra pelo `acting_user_id` (não pelo participante desejado).

### Convenções já usadas pela equipe nos títulos

`"joao 12p"`, `"MARIA 1P"`, `"Sicrano 17 pessoas"`, `"Beltrana Silva 2p ❌"` (❌ = cancelado).
O parser aceita `Np`, `NP`, `N pessoas` em qualquer posição e trata ❌ ou "CANCELADO" como cancelado.
Descrições variam muito; a linha `Quantidade de participantes: N` é o fallback.

### Status do agendamento: `meeting_outcome` (o que a UI mostra) vs. `status` (testado 14/09/2026)

O status que a UI da Sellflux exibe ("Agendado", "Cancelado"…) é o campo **`meeting_outcome`**:

| `meeting_outcome` | UI | No app |
|---|---|---|
| `scheduled` | Agendado | `agendado` — ocupa kart |
| `rescheduled` | Reagendado | `reagendado` — ocupa kart (decisão do cliente, 14/09) |
| `completed` | Concluído | `concluido` — ocupa kart (é passado) |
| `canceled` | Cancelado | `cancelado` — **não ocupa** |
| `no_show` (presumido) | Não compareceu | `nao_compareceu` |

- **Só vem em `GET /crm/schedules/:id`** — a listagem não traz o campo. O app busca o detalhe de cada
  agendamento do dia (6 em paralelo; com 120 simultâneos metade das chamadas falha).
- **Não é gravável pela API pública**: `PUT` com `meeting_outcome`/`outcome`/`result` → "Nenhum campo
  para atualizar". Cancelar pela API = só dá para marcar ❌ no título (convenção da equipe, que também
  marca "Cancelado" na UI — os três ❌ da amostra estavam `canceled`).
- Outros campos que só aparecem no `GET /:id`: `platform_event_data.status` ("confirmed"),
  `conclusion_note`, `organizator_id`, `send_notification`, `work_schedule_id` (null nos exemplos).

E o campo `status` numérico:

| `status` | API | UI |
|---|---|---|
| `1` | padrão (4.440 de 4.441) | — |
| `2` | `PUT` aceita; some do filtro `status=1` | **não muda nada** (continua "Agendado") |
| `3` | `PUT` aceita — e o agendamento **some** de tudo (`GET /:id` → "não encontrado") = remoção lógica |

`task_completed` não é editável. `?status=` vazio devolve 0 itens — omitir o parâmetro.
