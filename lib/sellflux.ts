/**
 * Cliente da API pública da Sellflux (https://developers.sellflux.com). Só roda no servidor.
 * Referência dos endpoints: SELLFLUX-API.md. Os shapes de resposta de /crm/* não são documentados —
 * `normalizarSchedule` tolera variações e o que for descoberto com o token real deve ser anotado lá.
 */
import { isCancelado, parseNome, parsePessoas, parseTelefone } from "./parse";
import type { Reserva, StatusReserva } from "./slots";
import { utcToLocal } from "./tz";

const BASE = "https://apis.sellflux.app";

export class SellfluxError extends Error {
  constructor(public status: number, public body: unknown, message?: string) {
    super(message ?? `Sellflux ${status}`);
  }
}

function token(): string {
  const t = process.env.SELLFLUX_TOKEN;
  if (!t) throw new Error("SELLFLUX_TOKEN ausente");
  return t;
}

/**
 * Usuário em nome de quem a chave de API age nas rotas de CRM (`acting_user_id`).
 * As rotas exigem um usuário com permissão de CRM no projeto; os usuários "Recepção" podem não ter.
 * Se SELLFLUX_ACTING_USER_ID estiver definido, ele é usado sempre e o usuário da unidade entra só como participante.
 */
export function actingUserId(unidadeUserId: number): number {
  const env = process.env.SELLFLUX_ACTING_USER_ID;
  const n = env ? Number(env) : NaN;
  return Number.isFinite(n) && n > 0 ? n : unidadeUserId;
}

async function sf<T = unknown>(path: string, init: RequestInit & { query?: Record<string, string | number | boolean | undefined> } = {}): Promise<T> {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(init.query ?? {})) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${token()}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* mantém texto */ }
  if (!res.ok) {
    const msg = typeof body === "object" && body && "msg" in body ? String((body as { msg: unknown }).msg) : `${res.status} em ${init.method ?? "GET"} ${path}`;
    throw new SellfluxError(res.status, body, `Sellflux: ${msg}`);
  }
  return body as T;
}

/** Listas da Sellflux vêm como `{ data: [...] , total, page, limit, total_pages }` ou, às vezes, como array puro. */
function itens<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    for (const k of ["data", "items", "rows", "schedules", "users"]) if (Array.isArray(b[k])) return b[k] as T[];
    if (b.data && typeof b.data === "object") return itens<T>(b.data);
  }
  return [];
}

// ---------- Equipe ----------

export type UsuarioSellflux = { id: number; nome: string; email: string | null; raw: unknown };

export async function listarUsuarios(search = ""): Promise<UsuarioSellflux[]> {
  const env = process.env.SELLFLUX_ACTING_USER_ID;
  const body = await sf("/api/v1/crm/team/users", { query: { page: 1, limit: 100, search, acting_user_id: env || undefined } });
  return itens<Record<string, unknown>>(body).map((u) => ({
    id: Number(u.id ?? u.user_id),
    nome: String(u.name ?? u.nome ?? u.full_name ?? u.username ?? u.email ?? u.id),
    email: (u.email as string | undefined) ?? null,
    raw: u,
  })).filter((u) => Number.isFinite(u.id));
}

// ---------- Agenda ----------

export type ScheduleInput = {
  subject: string;
  description: string;
  start_date: string;
  end_date: string;
  lead_ids?: string;
  participant_user_ids?: string;
  acting_user_id: number;
};

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function idsDe(v: unknown): number[] {
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === "object" ? num((x as Record<string, unknown>).id ?? (x as Record<string, unknown>).lead_id) : num(x))).filter((n): n is number => n !== null);
  if (typeof v === "string") return v.split(",").map((s) => num(s.trim())).filter((n): n is number => n !== null);
  const n = num(v);
  return n === null ? [] : [n];
}

/** Ids de usuários participantes, em qualquer um dos formatos que a Sellflux possa devolver. */
export function participantesDe(raw: Record<string, unknown>): number[] {
  const cands = [raw.participant_user_ids, raw.participants, raw.participant_ids, raw.users, raw.user_ids];
  const out = new Set<number>();
  for (const c of cands) for (const id of idsDe(c)) out.add(id);
  for (const c of [raw.action_user_id, raw.user_id, raw.created_by, raw.owner_id, raw.creator_id]) { const n = num(c); if (n !== null) out.add(n); }
  return [...out];
}

export function normalizarSchedule(raw: Record<string, unknown>): Reserva | null {
  const id = raw.id ?? raw.schedule_id;
  const startIso = (raw.start_date ?? raw.start ?? raw.starts_at) as string | undefined;
  if (id === undefined || !startIso) return null;
  const subject = String(raw.subject ?? raw.title ?? "");
  const description = (raw.description as string | null | undefined) ?? null;
  const pessoas = parsePessoas(subject, description);
  const { data, horario } = utcToLocal(startIso);
  // O status que a UI da Sellflux mostra é `meeting_outcome` (só vem em GET /:id — ver enriquecerComOutcome).
  // A equipe também marca ❌ no título; qualquer um dos dois cancela.
  const outcome = typeof raw.meeting_outcome === "string" ? raw.meeting_outcome : null;
  const status: StatusReserva = isCancelado(subject) ? "cancelado" : OUTCOME_STATUS[outcome ?? ""] ?? "agendado";
  return {
    id: id as number | string,
    nome: parseNome(subject) || "(sem nome)",
    pessoas: pessoas ?? 1,
    pessoasIdentificadas: pessoas !== null,
    telefone: parseTelefone(description),
    data,
    horario,
    startIso: new Date(startIso).toISOString(),
    endIso: raw.end_date ? new Date(String(raw.end_date)).toISOString() : null,
    subject,
    description,
    status,
    outcome,
    cancelado: status === "cancelado",
    leadIds: idsDe(raw.lead_ids ?? raw.leads),
  };
}

export type ScheduleRaw = Record<string, unknown>;

const OUTCOME_STATUS: Record<string, StatusReserva> = {
  scheduled: "agendado",
  rescheduled: "reagendado",
  completed: "concluido",
  canceled: "cancelado",
  cancelled: "cancelado",
  no_show: "nao_compareceu",
  noshow: "nao_compareceu",
};

/** Executa `fn` sobre os itens com no máximo `n` em paralelo (a Sellflux falha com muitas chamadas simultâneas). */
async function emLotes<T, R>(itens: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(itens.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (i < itens.length) { const k = i++; out[k] = await fn(itens[k]); }
  }));
  return out;
}

/**
 * A listagem não traz `meeting_outcome`; GET /:id traz. Busca o detalhe de cada item (6 por vez, 1 retry).
 * Se o detalhe falhar, mantém o item da lista — o título com ❌ ainda cobre o cancelamento.
 */
export async function enriquecerComOutcome(raws: ScheduleRaw[], unidadeUserId: number): Promise<ScheduleRaw[]> {
  return emLotes(raws, 6, async (r) => {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        const d = await buscarScheduleRaw(r.id as number, unidadeUserId);
        if (d && typeof d === "object" && "meeting_outcome" in d) return { ...r, ...d };
      } catch { /* tenta de novo */ }
    }
    return r;
  });
}

/**
 * Agendamentos numa janela de tempo.
 *
 * A Sellflux IGNORA `start_date`/`end_date` nesta rota (testado com todos os formatos em 14/09/2026),
 * mas devolve a lista ordenada por `start_date` desc e aceita `limit` grande. Então lemos página a página
 * e paramos assim que o último item ficou antes da janela — para "hoje" costuma ser 1 requisição
 * (só os agendamentos futuros vêm antes). Filtro final é feito aqui.
 */
const PAGINA = 300;
const MAX_PAGINAS = 20; // 6.000 agendamentos — datas muito antigas param aqui

export async function listarSchedulesRaw(opts: { unidadeUserId: number; startIso: string; endIso: string; status?: 1 | 2 }): Promise<ScheduleRaw[]> {
  const acting = actingUserId(opts.unidadeUserId);
  const out: ScheduleRaw[] = [];
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const body = await sf("/api/v1/crm/schedules", {
      // only_my_participation só faz sentido quando agimos como o próprio usuário da unidade
      query: { page, limit: PAGINA, status: opts.status, only_my_participation: acting === opts.unidadeUserId, acting_user_id: acting },
    });
    const lista = itens<ScheduleRaw>(body);
    let passouDaJanela = false;
    for (const r of lista) {
      const start = typeof r.start_date === "string" ? new Date(r.start_date).toISOString() : null;
      if (!start) continue;
      if (start < opts.startIso) { passouDaJanela = true; continue; }
      if (start <= opts.endIso) out.push(r);
    }
    const totalPages = body && typeof body === "object" ? num((body as Record<string, unknown>).total_pages) : null;
    if (passouDaJanela || lista.length < PAGINA || (totalPages !== null && page >= totalPages)) break;
  }
  return out;
}

export async function listarReservas(opts: { unidadeUserId: number; startIso: string; endIso: string }): Promise<Reserva[]> {
  const raws = (await listarSchedulesRaw(opts))
    // a agenda da unidade = agendamentos em que o usuário da unidade participa; filtramos no servidor
    // porque, agindo como outro usuário, a lista pode vir com o projeto inteiro
    .filter((r) => { const p = participantesDe(r); return p.length === 0 || p.includes(opts.unidadeUserId); });
  return (await enriquecerComOutcome(raws, opts.unidadeUserId))
    .map(normalizarSchedule)
    .filter((r): r is Reserva => r !== null);
}

export async function buscarScheduleRaw(id: number | string, unidadeUserId: number): Promise<ScheduleRaw> {
  const body = await sf<Record<string, unknown>>(`/api/v1/crm/schedules/${id}`, { query: { acting_user_id: actingUserId(unidadeUserId) } });
  return (body && typeof body === "object" && "data" in body && body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : body) as ScheduleRaw;
}

/** Ids do lead e do chat vinculados a um agendamento — só existem quando ele foi criado a partir de um contato. */
export type VinculosSchedule = { leadId: number | null; chatId: number | null };

/**
 * `GET /crm/schedules/:id/links` devolve vínculos `{source_type, source_id, target_type, target_id}`;
 * os que interessam são `lead → schedule` e `chat → schedule`. O id do chat não aparece em nenhuma outra rota
 * (testado 15/09/2026), e é ele que abre a conversa em app.sellflux.com/chats/:id.
 */
export async function buscarVinculosSchedule(id: number | string, unidadeUserId: number): Promise<VinculosSchedule> {
  const body = await sf(`/api/v1/crm/schedules/${id}/links`, { query: { acting_user_id: actingUserId(unidadeUserId) } });
  const out: VinculosSchedule = { leadId: null, chatId: null };
  for (const l of itens<Record<string, unknown>>(body)) {
    if (String(l.target_type) !== "schedule" || String(l.target_id) !== String(id)) continue;
    const sid = num(l.source_id);
    if (sid === null) continue;
    if (l.source_type === "lead" && out.leadId === null) out.leadId = sid;
    if (l.source_type === "chat" && out.chatId === null) out.chatId = sid;
  }
  return out;
}

export async function criarSchedule(input: ScheduleInput): Promise<ScheduleRaw> {
  const body = await sf<Record<string, unknown>>("/api/v1/crm/schedules", {
    method: "POST",
    body: JSON.stringify({ ...input, timezone: "America/Sao_Paulo", schedule_type: "meeting" }),
  });
  return (body && typeof body === "object" && "data" in body && body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : body) as ScheduleRaw;
}

export async function atualizarSchedule(id: number | string, patch: Partial<ScheduleInput> & { status?: 1 | 2 }): Promise<ScheduleRaw> {
  const body = await sf<Record<string, unknown>>(`/api/v1/crm/schedules/${id}`, { method: "PUT", body: JSON.stringify(patch) });
  return (body && typeof body === "object" && "data" in body && body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : body) as ScheduleRaw;
}

// ---------- Leads ----------

export const CAMPO_PARTICIPANTES = "quantidade_de_participantes_ultimo";

export type LeadSellflux = { id: number; name: string | null; phone: string | null; raw: unknown };

function leadDe(raw: Record<string, unknown>): LeadSellflux {
  return { id: Number(raw.id), name: (raw.name as string | null) ?? null, phone: raw.phone != null ? String(raw.phone) : null, raw };
}

/** Busca por telefone (search cobre nome/e-mail/telefone). Compara pelos dígitos para não depender do formato salvo. */
export async function buscarLeadPorTelefone(telefoneE164: string): Promise<LeadSellflux | null> {
  const digitos = telefoneE164.replace(/\D/g, "");
  const nacional = digitos.startsWith("55") ? digitos.slice(2) : digitos;
  for (const termo of [digitos, nacional]) {
    const body = await sf("/api/v1/lead/project", { query: { page: 1, search: termo } });
    const leads = itens<Record<string, unknown>>(body).map(leadDe);
    const exato = leads.find((l) => { const d = (l.phone ?? "").replace(/\D/g, ""); return d === digitos || d === nacional || (d.startsWith("55") ? d.slice(2) : d) === nacional; });
    if (exato) return exato;
  }
  return null;
}

export async function criarLead(input: { name: string; phone: string; participantes: number }): Promise<number> {
  const body = await sf<Record<string, unknown>>("/api/v1/lead", {
    method: "POST",
    body: JSON.stringify({ name: input.name, phone: input.phone, tags: ["nk-agenda"], [CAMPO_PARTICIPANTES]: String(input.participantes) }),
  });
  const id = Number(body?.id ?? (body?.data as Record<string, unknown> | undefined)?.id);
  if (!Number.isFinite(id)) throw new SellfluxError(500, body, "Sellflux: POST /lead não devolveu id");
  return id;
}

export async function atualizarLead(id: number, patch: { name?: string; participantes?: number }): Promise<void> {
  const body: Record<string, unknown> = { id };
  if (patch.name) body.name = patch.name;
  if (patch.participantes !== undefined) body[CAMPO_PARTICIPANTES] = String(patch.participantes);
  await sf("/api/v1/lead", { method: "PUT", body: JSON.stringify(body) });
}

/** Garante um lead com esse telefone e atualiza o campo de participantes. Devolve o id. */
export async function upsertLead(input: { name: string; phone: string; participantes: number }): Promise<number> {
  const existente = await buscarLeadPorTelefone(input.phone);
  if (existente) {
    await atualizarLead(existente.id, { participantes: input.participantes, name: existente.name ? undefined : input.name });
    return existente.id;
  }
  return criarLead(input);
}
