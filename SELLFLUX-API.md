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
