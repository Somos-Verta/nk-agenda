/**
 * Regras de negócio da agenda: grade, capacidade, criação/edição/status espelhados na Sellflux.
 * A Sellflux é a fonte de verdade dos agendamentos; a capacidade é nossa (tabela nk_unidades) e o status
 * que a API da Sellflux não grava fica no registro local (nk_reserva_status, ver lib/status.ts).
 */
import { z } from "zod";
import { buscarStatusLocal, buscarUnidade, listarStatusDoDia, salvarStatusLocal } from "./db";
import { AppError } from "./http";
import { atualizarDescription, formatarTelefone, isCancelado, MARCA_CANCELADO, montarDescription, montarSubject, validarTelefone, type CamposDescription } from "./parse";
import { actingUserId, atualizarLead, atualizarSchedule, buscarScheduleRaw, buscarVinculosSchedule, criarSchedule, listarReservas, normalizarSchedule, upsertLead, type VinculosSchedule } from "./sellflux";
import { gerarHorarios, montarGrade, slotsQueCabem, vagasEm, type Reserva, type Slot, type StatusReserva, type Unidade } from "./slots";
import { aplicarStatusLocal, statusParaSellflux, statusSchema, type StatusLocal } from "./status";
import { dataCurta, localToUtcIso, somarMinutos } from "./tz";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const novaReservaSchema = z.object({
  unidade: z.string().min(1),
  data: z.string().regex(DATA),
  horario: z.string().regex(HORA),
  nome: z.string().trim().min(2).max(80),
  telefone: z.string().min(8),
  pessoas: z.number().int().min(1).max(200),
  /** status ao criar (padrão Agendado). Cancelado não faz sentido numa reserva nova. */
  status: statusSchema.exclude(["cancelado"]).optional(),
});
export type NovaReserva = z.infer<typeof novaReservaSchema>;

export const editarReservaSchema = novaReservaSchema.omit({ status: true }).partial().required({ unidade: true }).extend({
  /** descrição na Sellflux, editada como texto livre; "" limpa */
  description: z.string().max(4000).optional(),
});
export type EditarReserva = z.infer<typeof editarReservaSchema>;

export type Grade = { unidade: Unidade; data: string; slots: Slot[]; foraDaGrade: Reserva[] };

export async function unidadeOuErro(slug: string): Promise<Unidade & { sellfluxUserId: number }> {
  const u = await buscarUnidade(slug);
  if (!u) throw new AppError(404, { erro: "unidade_inexistente", unidade: slug });
  if (!u.sellfluxUserId) throw new AppError(400, { erro: "unidade_nao_configurada", mensagem: `A unidade ${u.nome} ainda não está ligada a um usuário da Sellflux. Configure em /configuracao.` });
  return u as Unidade & { sellfluxUserId: number };
}

/**
 * `fresh` força a leitura na Sellflux, ignorando o cache. Obrigatório antes de gravar
 * (duas atendentes podem reservar a mesma bateria no mesmo minuto); a tela usa o cache.
 */
export async function carregarGrade(unidade: Unidade & { sellfluxUserId: number }, data: string, opts?: { fresh?: boolean }): Promise<Grade> {
  // o registro de status é do dia inteiro e não depende da listagem: lê em paralelo com a Sellflux
  const [reservas, locais] = await Promise.all([
    listarReservas({
      unidadeUserId: unidade.sellfluxUserId,
      startIso: localToUtcIso(data, "00:00"),
      endIso: localToUtcIso(data, "23:59"),
      fresh: opts?.fresh,
    }),
    listarStatusDoDia(data),
  ]);
  return { unidade, data, ...montarGrade(unidade, data, aplicarStatusLocal(reservas, locais)) };
}

function telefoneOuErro(t: string): string {
  const v = validarTelefone(t);
  if (!v.ok) throw new AppError(400, { erro: "telefone_invalido", mensagem: `Telefone inválido: ${v.motivo} Ex.: (62) 98765-4321.` });
  return v.e164;
}

function validarSlot(unidade: Unidade, data: string, horario: string) {
  if (!gerarHorarios(unidade, data).includes(horario)) {
    throw new AppError(400, { erro: "horario_invalido", mensagem: `${horario} não é um horário de bateria da unidade ${unidade.nome} nesse dia.` });
  }
}

function lotado(grade: Grade, horario: string, pessoas: number, vagas: number): never {
  throw new AppError(409, {
    erro: "lotado",
    mensagem: `A bateria ${horario} tem ${vagas} vaga${vagas === 1 ? "" : "s"} e foram pedidas ${pessoas}.`,
    vagas,
    alternativas: slotsQueCabem(grade.slots, pessoas).map((s) => ({ horario: s.horario, vagas: s.vagas })),
  });
}

function campos(nome: string, data: string, horario: string, telefoneE164: string, pessoas: number): CamposDescription {
  return { nome, dataCurta: dataCurta(data), horario, telefoneFormatado: formatarTelefone(telefoneE164), pessoas };
}

function periodo(data: string, horario: string) {
  return { start_date: localToUtcIso(data, horario), end_date: localToUtcIso(data, somarMinutos(horario, 30) ?? "23:59") };
}

/** Reserva recém-criada; `aviso` quando algo secundário (o status escolhido) não pôde ser gravado. */
export type ReservaCriada = Reserva & { aviso?: string };

export async function criarReserva(input: NovaReserva): Promise<ReservaCriada> {
  const unidade = await unidadeOuErro(input.unidade);
  validarSlot(unidade, input.data, input.horario);
  const telefone = telefoneOuErro(input.telefone);

  // recalcula no servidor — nunca confia na vaga que a tela mostrou, nem no cache da listagem
  const grade = await carregarGrade(unidade, input.data, { fresh: true });
  const vagas = vagasEm(grade.slots, input.horario) ?? 0;
  if (input.pessoas > vagas) lotado(grade, input.horario, input.pessoas, vagas);

  const leadId = await upsertLead({ name: input.nome, phone: telefone, participantes: input.pessoas });
  const raw = await criarSchedule({
    subject: montarSubject(input.nome, input.pessoas),
    description: montarDescription(campos(input.nome, input.data, input.horario, telefone, input.pessoas)),
    ...periodo(input.data, input.horario),
    lead_ids: String(leadId),
    participant_user_ids: String(unidade.sellfluxUserId),
    acting_user_id: actingUserId(unidade.sellfluxUserId),
  });
  const reserva = normalizarSchedule(raw);
  if (reserva) return comStatusEscolhido(reserva, unidade.sellfluxUserId, input.status);
  // resposta sem campos reconhecíveis: devolve o que enviamos, com o id que der para achar
  const id = (raw.id ?? (raw.data as Record<string, unknown> | undefined)?.id ?? "") as number | string;
  return { id, nome: input.nome, pessoas: input.pessoas, pessoasIdentificadas: true, telefone, data: input.data, horario: input.horario, startIso: localToUtcIso(input.data, input.horario), endIso: null, subject: montarSubject(input.nome, input.pessoas), description: null, status: "agendado", statusSellflux: "agendado", outcome: null, cancelado: false, leadIds: [leadId], ...(input.status && input.status !== "agendado" ? { aviso: `Reserva criada, mas o status ${STATUS_TEXTO[input.status]} não foi aplicado. Abra a reserva para defini-lo.` } : {}) };
}

const STATUS_TEXTO: Record<StatusReserva, string> = { nenhum: "Nenhum", agendado: "Agendado", concluido: "Concluído", reagendado: "Reagendado", nao_compareceu: "Não compareceu", cancelado: "Cancelado" };

/**
 * Aplica o status escolhido ao criar. A reserva já existe na Sellflux: se gravar o status falhar, não se
 * perde a reserva (e a atendente não recria em duplicidade) — ela volta como Agendado, com um aviso.
 */
async function comStatusEscolhido(reserva: Reserva, unidadeUserId: number, status?: StatusReserva): Promise<ReservaCriada> {
  if (!status || status === "agendado") return reserva;
  try {
    return await gravarStatus(reserva.id, unidadeUserId, reserva, status);
  } catch (e) {
    console.error("[status ao criar]", e);
    return { ...reserva, aviso: `Reserva criada, mas o status ${STATUS_TEXTO[status]} não foi gravado. Abra a reserva para defini-lo.` };
  }
}

export async function editarReserva(id: string, input: EditarReserva): Promise<Reserva> {
  const unidade = await unidadeOuErro(input.unidade);
  const { sf, atual, local } = await lerReserva(id, unidade.sellfluxUserId);
  if (atual.cancelado) throw new AppError(409, { erro: "reserva_cancelada", mensagem: "Reserva cancelada não pode ser editada. Mude o status para reativá-la." });

  const nome = input.nome ?? atual.nome;
  const data = input.data ?? atual.data;
  const horario = input.horario ?? atual.horario;
  const pessoas = input.pessoas ?? atual.pessoas;
  const telefone = input.telefone ? telefoneOuErro(input.telefone) : atual.telefone;
  if (!telefone) throw new AppError(400, { erro: "telefone_invalido", mensagem: "Esta reserva não tem telefone; informe um." });
  validarSlot(unidade, data, horario);

  const grade = await carregarGrade(unidade, data, { fresh: true });
  const vagas = vagasEm(grade.slots, horario, data === atual.data ? atual.id : undefined) ?? 0;
  if (pessoas > vagas) lotado(grade, horario, pessoas, vagas);

  if (atual.leadIds[0] && (input.pessoas !== undefined || input.nome)) {
    await atualizarLead(atual.leadIds[0], { participantes: pessoas, name: input.nome });
  }
  // descrição: o texto que a atendente mandou (ou o atual), com as linhas padrão dos campos alterados reescritas
  const alterados: (keyof CamposDescription)[] = [];
  if (input.nome !== undefined) alterados.push("nome");
  if (input.data !== undefined || input.horario !== undefined) alterados.push("dataCurta", "horario");
  if (input.telefone !== undefined) alterados.push("telefoneFormatado");
  if (input.pessoas !== undefined) alterados.push("pessoas");
  const description = atualizarDescription(input.description ?? atual.description, campos(nome, data, horario, telefone, pessoas), alterados);

  const raw = await atualizarSchedule(id, { subject: montarSubject(nome, pessoas), description, ...periodo(data, horario), acting_user_id: actingUserId(unidade.sellfluxUserId) });
  const salva = normalizarSchedule(raw);
  if (!salva) return { ...atual, nome, data, horario, pessoas, telefone, description, subject: montarSubject(nome, pessoas), startIso: localToUtcIso(data, horario) };
  // registro obsoleto (a Sellflux mudou depois dele) fica como está: regravar o `baseStatus` o faria valer de novo
  if (!local || local.baseStatus !== sf.statusSellflux) return salva;
  // o registro acompanha a reserva: novo dia (a grade lê por dia) e novo "como a Sellflux está" (o título foi reescrito)
  const atualizado: StatusLocal = { ...local, data: salva.data, baseStatus: salva.statusSellflux };
  await salvarStatusLocal(atualizado);
  return aplicarStatusLocal([salva], [atualizado])[0];
}

/** A reserva como a Sellflux a tem, mais o registro local do status (se houver). `atual` já traz o status efetivo. */
async function lerReserva(id: number | string, unidadeUserId: number): Promise<{ sf: Reserva; atual: Reserva; local: StatusLocal | null }> {
  const [raw, local] = await Promise.all([buscarScheduleRaw(id, unidadeUserId), buscarStatusLocal(id)]);
  const sf = normalizarSchedule(raw);
  if (!sf) throw new AppError(404, { erro: "reserva_inexistente", id });
  return { sf, atual: aplicarStatusLocal([sf], local ? [local] : [])[0], local };
}

/** Tira o ❌ que a equipe põe no título de quem cancela. */
const semMarca = (subject: string) => subject.replace(/\s*❌\s*/gu, " ").trim();

/**
 * Grava o status. À Sellflux vai o que a API aceita (`statusParaSellflux`); o registro local guarda sempre o
 * status completo — é ele que o app mostra para os que a Sellflux não grava.
 * `sf` = a reserva como a Sellflux a mostra agora (antes da gravação).
 */
async function gravarStatus(id: number | string, unidadeUserId: number, sf: Reserva, status: StatusReserva): Promise<Reserva> {
  // sair de "cancelado" para um status que a Sellflux não grava: lá volta para Agendado, senão o evento continuaria cancelado
  const alvo = statusParaSellflux(status) ?? (sf.statusSellflux === "cancelado" ? 1 : null);
  let depois = sf;
  if (alvo !== null) {
    const patch: Parameters<typeof atualizarSchedule>[1] = { status: alvo, acting_user_id: actingUserId(unidadeUserId) };
    // convenção da equipe: ❌ no título de quem cancela. Entra e sai junto com o status
    if (alvo === "cancelado" && !isCancelado(sf.subject)) patch.subject = `${sf.subject} ${MARCA_CANCELADO}`;
    if (alvo !== "cancelado" && sf.subject.includes(MARCA_CANCELADO)) patch.subject = semMarca(sf.subject);
    const raw = await atualizarSchedule(id, patch);
    depois = normalizarSchedule(raw) ?? { ...sf, statusSellflux: alvo === 1 ? "agendado" : alvo === 2 ? "concluido" : "cancelado", subject: patch.subject ?? sf.subject };
  }
  await salvarStatusLocal({ id, data: depois.data, status, baseStatus: depois.statusSellflux });
  return { ...depois, status, cancelado: status === "cancelado" };
}

/**
 * Muda o status de uma reserva. Reativar uma cancelada devolve os karts à bateria, então reconfere a vaga.
 * Concluído e Não compareceu continuam ocupando; só Cancelado libera.
 */
export async function definirStatus(id: string, slug: string, status: StatusReserva): Promise<Reserva> {
  const unidade = await unidadeOuErro(slug);
  const { sf, atual } = await lerReserva(id, unidade.sellfluxUserId);
  if (atual.status === status) return atual;

  if (atual.cancelado && status !== "cancelado") {
    const grade = await carregarGrade(unidade, atual.data, { fresh: true });
    const vagas = vagasEm(grade.slots, atual.horario); // null = fora da grade: não ocupa bateria
    if (vagas !== null && atual.pessoas > vagas) lotado(grade, atual.horario, atual.pessoas, vagas);
  }
  return gravarStatus(id, unidade.sellfluxUserId, sf, status);
}

/** Cancela: status Cancelado na Sellflux, ❌ no título (convenção da equipe) e libera os karts. */
export const cancelarReserva = (id: string, slug: string): Promise<Reserva> => definirStatus(id, slug, "cancelado");

/** Lead e chat de uma reserva, para os links "abrir na Sellflux" da ficha. */
export async function vinculosReserva(id: string, slug: string): Promise<VinculosSchedule> {
  const unidade = await unidadeOuErro(slug);
  return buscarVinculosSchedule(id, unidade.sellfluxUserId);
}
