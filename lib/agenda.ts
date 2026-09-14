/**
 * Regras de negócio da agenda: grade, capacidade, criação/edição/cancelamento espelhados na Sellflux.
 * A Sellflux é a fonte de verdade dos agendamentos; a capacidade é nossa (tabela nk_unidades).
 */
import { z } from "zod";
import { buscarUnidade } from "./db";
import { AppError } from "./http";
import { formatarTelefone, MARCA_CANCELADO, montarDescription, montarSubject, normalizarTelefone } from "./parse";
import { actingUserId, atualizarLead, atualizarSchedule, buscarScheduleRaw, criarSchedule, listarReservas, normalizarSchedule, upsertLead } from "./sellflux";
import { gerarHorarios, montarGrade, slotsQueCabem, vagasEm, type Reserva, type Slot, type Unidade } from "./slots";
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
});
export type NovaReserva = z.infer<typeof novaReservaSchema>;

export const editarReservaSchema = novaReservaSchema.partial().required({ unidade: true });
export type EditarReserva = z.infer<typeof editarReservaSchema>;

export type Grade = { unidade: Unidade; data: string; slots: Slot[]; foraDaGrade: Reserva[] };

export async function unidadeOuErro(slug: string): Promise<Unidade & { sellfluxUserId: number }> {
  const u = await buscarUnidade(slug);
  if (!u) throw new AppError(404, { erro: "unidade_inexistente", unidade: slug });
  if (!u.sellfluxUserId) throw new AppError(400, { erro: "unidade_nao_configurada", mensagem: `A unidade ${u.nome} ainda não está ligada a um usuário da Sellflux. Configure em /configuracao.` });
  return u as Unidade & { sellfluxUserId: number };
}

export async function carregarGrade(unidade: Unidade & { sellfluxUserId: number }, data: string): Promise<Grade> {
  const reservas = await listarReservas({
    unidadeUserId: unidade.sellfluxUserId,
    startIso: localToUtcIso(data, "00:00"),
    endIso: localToUtcIso(data, "23:59"),
  });
  return { unidade, data, ...montarGrade(unidade, data, reservas) };
}

function telefoneOuErro(t: string): string {
  const e164 = normalizarTelefone(t);
  if (!e164) throw new AppError(400, { erro: "telefone_invalido", mensagem: "Informe DDD + número (ex.: 62 98765-4321)." });
  return e164;
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

function textos(nome: string, data: string, horario: string, telefoneE164: string, pessoas: number) {
  return {
    subject: montarSubject(nome, pessoas),
    description: montarDescription({ nome, dataCurta: dataCurta(data), horario, telefoneFormatado: formatarTelefone(telefoneE164), pessoas }),
    start_date: localToUtcIso(data, horario),
    end_date: localToUtcIso(data, somarMinutos(horario, 30) ?? "23:59"),
  };
}

export async function criarReserva(input: NovaReserva): Promise<Reserva> {
  const unidade = await unidadeOuErro(input.unidade);
  validarSlot(unidade, input.data, input.horario);
  const telefone = telefoneOuErro(input.telefone);

  // recalcula no servidor — nunca confia na vaga que a tela mostrou
  const grade = await carregarGrade(unidade, input.data);
  const vagas = vagasEm(grade.slots, input.horario) ?? 0;
  if (input.pessoas > vagas) lotado(grade, input.horario, input.pessoas, vagas);

  const leadId = await upsertLead({ name: input.nome, phone: telefone, participantes: input.pessoas });
  const raw = await criarSchedule({
    ...textos(input.nome, input.data, input.horario, telefone, input.pessoas),
    lead_ids: String(leadId),
    participant_user_ids: String(unidade.sellfluxUserId),
    acting_user_id: actingUserId(unidade.sellfluxUserId),
  });
  const reserva = normalizarSchedule(raw);
  if (reserva) return reserva;
  // resposta sem campos reconhecíveis: devolve o que enviamos, com o id que der para achar
  const id = (raw.id ?? (raw.data as Record<string, unknown> | undefined)?.id ?? "") as number | string;
  return { id, nome: input.nome, pessoas: input.pessoas, pessoasIdentificadas: true, telefone, data: input.data, horario: input.horario, startIso: localToUtcIso(input.data, input.horario), endIso: null, subject: montarSubject(input.nome, input.pessoas), description: null, status: "agendado", outcome: null, cancelado: false, leadIds: [leadId] };
}

export async function editarReserva(id: string, input: EditarReserva): Promise<Reserva> {
  const unidade = await unidadeOuErro(input.unidade);
  const atualRaw = await buscarScheduleRaw(id, unidade.sellfluxUserId);
  const atual = normalizarSchedule(atualRaw);
  if (!atual) throw new AppError(404, { erro: "reserva_inexistente", id });
  if (atual.cancelado) throw new AppError(409, { erro: "reserva_cancelada", mensagem: "Reserva cancelada não pode ser editada." });

  const nome = input.nome ?? atual.nome;
  const data = input.data ?? atual.data;
  const horario = input.horario ?? atual.horario;
  const pessoas = input.pessoas ?? atual.pessoas;
  const telefone = input.telefone ? telefoneOuErro(input.telefone) : atual.telefone;
  if (!telefone) throw new AppError(400, { erro: "telefone_invalido", mensagem: "Esta reserva não tem telefone; informe um." });
  validarSlot(unidade, data, horario);

  const grade = await carregarGrade(unidade, data);
  const vagas = vagasEm(grade.slots, horario, data === atual.data ? atual.id : undefined) ?? 0;
  if (pessoas > vagas) lotado(grade, horario, pessoas, vagas);

  if (atual.leadIds[0] && (input.pessoas !== undefined || input.nome)) {
    await atualizarLead(atual.leadIds[0], { participantes: pessoas, name: input.nome });
  }
  const raw = await atualizarSchedule(id, { ...textos(nome, data, horario, telefone, pessoas), acting_user_id: actingUserId(unidade.sellfluxUserId) });
  return normalizarSchedule(raw) ?? { ...atual, nome, data, horario, pessoas, telefone, subject: montarSubject(nome, pessoas), startIso: localToUtcIso(data, horario) };
}

/**
 * Cancela com a convenção da equipe: ❌ no título. O status "Cancelado" da UI (`meeting_outcome`) não é
 * gravável pela API pública; o ❌ é o que dá para fazer e é o que a equipe já faz à mão.
 * Reservas canceladas continuam na lista, riscadas, e não ocupam kart.
 */
export async function cancelarReserva(id: string, slug: string): Promise<Reserva> {
  const unidade = await unidadeOuErro(slug);
  const atual = normalizarSchedule(await buscarScheduleRaw(id, unidade.sellfluxUserId));
  if (!atual) throw new AppError(404, { erro: "reserva_inexistente", id });
  if (atual.cancelado) return atual;

  const raw = await atualizarSchedule(id, { subject: `${atual.subject} ${MARCA_CANCELADO}`, acting_user_id: actingUserId(unidade.sellfluxUserId) });
  return normalizarSchedule(raw) ?? { ...atual, subject: `${atual.subject} ${MARCA_CANCELADO}`, status: "cancelado", cancelado: true };
}
