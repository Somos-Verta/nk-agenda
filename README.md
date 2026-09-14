# Agenda Nacional Kart

Sistema de agendamento de baterias para o kartódromo Nacional Kart (unidades Goiânia e São Paulo).

Arquivo único, sem build e sem dependências: abra `agenda-nacional-kart.html` no navegador e funciona.

**No ar:** https://nacional-kart-agenda.vercel.app

> ⚠️ **A página não tem autenticação.** Quem tiver o link entra e mexe na agenda. Hoje o risco
> é baixo porque o modo local guarda os dados no navegador de cada visitante — não há agenda
> compartilhada para vazar. **Isso deixa de ser verdade no minuto em que o backend entrar:**
> a mesma URL pública passaria a ler e gravar a agenda real do cliente. Login é pré-requisito
> para ligar a API, não um item de melhoria.

## O modelo

A grade de baterias **não é uma lista fixa** — ela é gerada a partir da configuração de cada
unidade (abertura, fechamento, duração da bateria, intervalo, karts por bateria). Mudar a
capacidade de 10 para 12 karts recalcula a grade inteira.

Cada agendamento consome N karts de uma bateria. O **encaixe** é achar bateria com vagas ≥ N.
Agendamentos com status `cancelado` ou `noshow` não ocupam kart.

## Telas

| Tela | Para quê |
|---|---|
| **Grade do dia** | Visão da atendente: um card por bateria, ocupação, vagas, verde/âmbar/vermelho |
| **Encaixe** | "Chegaram 4 pessoas" → em quais baterias cabem, com marcação de encaixe exato e opção de dividir o grupo |
| **Agendamentos** | Lista com busca, filtro por status/período e export CSV |
| **Configuração** | Horários, duração, capacidade, preço, dias de funcionamento, unidades |
| **API / Sellflux** | Modo de armazenamento e o contrato de integração |

## Modos de armazenamento

Toda a persistência passa por `Store.*`, que tem dois modos. A interface não sabe qual está ativo.

- **`local`** — `localStorage`, roda sem servidor. Serve para validar o fluxo.
  Limitação: os dados ficam no navegador de cada atendente, não são compartilhados.
- **`api`** — REST. É o modo de produção, e o único em que o Sellflux consegue agendar.

## Contrato da API (a implementar no backend)

Autenticação em todas as chamadas: `Authorization: Bearer <token>`.
Respostas em JSON. Fuso: `America/Sao_Paulo`.

| Verbo | Rota | O que faz |
|---|---|---|
| `GET` | `/disponibilidade?data=&pessoas=&unidade=` | Baterias com vaga |
| `POST` | `/agendamentos` | Cria — **é o que o Sellflux chama** |
| `GET` | `/agendamentos?data=&unidade=` | Lista do dia |
| `PATCH` | `/agendamentos/{id}` | Altera / muda status |
| `DELETE` | `/agendamentos/{id}` | Remove |
| `GET` | `/config?unidade=` | Grade e capacidade |

### POST /agendamentos

```json
{
  "nome": "{{lead.name}}",
  "telefone": "{{lead.phone}}",
  "email": "{{lead.email}}",
  "pessoas": 2,
  "data": "2026-07-20",
  "bateria": "19:00",
  "unidade": "goiania",
  "origem": "sellflux",
  "external_id": "{{lead.id}}",
  "observacoes": "{{lead.notes}}"
}
```

`bateria` vazio ou omitido ativa o **encaixe automático**: a API escolhe a primeira bateria do
dia com vaga para o grupo inteiro e devolve qual foi. `external_id` evita duplicar o mesmo lead.

**201 — agendou**

```json
{ "id": "ag_9f3a21", "status": "confirmado", "data": "2026-07-20",
  "bateria": "19:00", "pessoas": 2, "vagas_restantes": 6 }
```

**409 — bateria lotada**, já devolvendo alternativas para o Sellflux reofertar:

```json
{ "erro": "bateria_lotada",
  "mensagem": "A bateria 19:00 tem 1 vaga e foram pedidas 2.",
  "alternativas": [ { "bateria": "19:20", "vagas": 8 }, { "bateria": "19:40", "vagas": 10 } ] }
```

## Integração Sellflux

Especificação completa em [SELLFLUX-API.md](SELLFLUX-API.md), levantada da documentação
oficial. O resumo que decide a arquitetura:

**A Sellflux tem agenda (`/api/v1/crm/schedules`), mas não tem capacidade.** É um calendário
de compromissos — nenhum campo de vaga ou recurso limitado. Ela não sabe que uma bateria tem
10 karts. Por isso **a grade, a capacidade e o encaixe continuam sendo desta agenda**, que é
a fonte de verdade; a Sellflux é a camada de CRM e comunicação.

Ao criar/alterar uma reserva, o painel espelha na Sellflux em quatro passos:

1. `GET /api/v1/lead/project?search=<telefone>` — acha o lead (evita duplicar)
2. `POST /api/v1/lead` — cria se não achou, com `unidade`/`bateria`/`pessoas` como campos personalizados
3. `POST /api/v1/crm/schedules` — o compromisso da bateria, vinculado ao lead
4. `POST /automation/v1/whatsapp/lead` — confirmação via template (opcional)

O espelhamento é assíncrono e **não bloqueia a atendente**: se a Sellflux falhar, a reserva
local continua válida e o erro fica marcado no registro (`sellflux_erro`).

### Pré-requisitos no projeto Sellflux

- **Campos personalizados** `unidade`, `bateria` e `pessoas` criados — senão a Sellflux
  ignora as chaves **em silêncio**, sem erro, e o dado não aparece no lead.
- Um **`acting_user_id`** válido (`GET /api/v1/crm/team/users`) — obrigatório nas rotas de
  CRM quando a auth é por chave de API.
- Um **template de WhatsApp**, se quiser a confirmação automática.

### Por que existe um proxy

A chave da Sellflux dá acesso ao CRM inteiro do projeto. No browser ela seria legível por
qualquer pessoa que abrisse a agenda, e a chamada direta bate em CORS de qualquer jeito.
Então o painel aponta para um **proxy** — uma rota da nossa API que guarda a chave, espelha
os mesmos paths da Sellflux e injeta o `Authorization`.

## Estado atual

O backend **ainda não existe** — hoje só o modo local funciona, e sem o proxy o espelhamento
na Sellflux fica desligado. Próximo passo: subir no Supabase (Postgres + Edge Functions) a
API do contrato acima **e** o proxy da Sellflux.

Depois disso vale montar na Sellflux uma automação com `domain_type: "schedule"` (disparada
por agendamento) para lembrete de bateria e follow-up de no-show — sem precisarmos agendar
nada do nosso lado.

Os valores de configuração hoje são um chute de partida e precisam ser confirmados com o
cliente: 10h–22h, baterias de 20min com 10min de intervalo, 10 karts, R$ 60 por piloto.

## Debug

O console expõe `NK.DB`, `NK.Store`, `NK.baterias(unidade, data)` e `NK.seed()`.
