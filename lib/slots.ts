import { diaDaSemana, minutosDoDia, somarMinutos, utcToLocal } from "./tz";

export type Intervalo = { inicio: string; fim: string }; // "HH:mm"
export type DiaSemana = "0" | "1" | "2" | "3" | "4" | "5" | "6";
export type Horarios = Record<DiaSemana, Intervalo[]>;

export type Unidade = {
  slug: string;
  nome: string;
  sellfluxUserId: number | null;
  capacidade: number;
  duracaoMin: number;
  horarios: Horarios;
};

/** Espelha o `meeting_outcome` da Sellflux (o status que a UI dela mostra). */
export type StatusReserva = "agendado" | "reagendado" | "concluido" | "cancelado" | "nao_compareceu";

export const STATUS_LABEL: Record<StatusReserva, string> = {
  agendado: "Agendado",
  reagendado: "Reagendado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  nao_compareceu: "Não compareceu",
};

/** Agendamento já normalizado (independente do shape cru da Sellflux). */
export type Reserva = {
  id: number | string;
  nome: string;
  pessoas: number;
  /** false quando a quantidade não pôde ser lida do título/descrição (conta como 1). */
  pessoasIdentificadas: boolean;
  telefone: string | null;
  data: string; // YYYY-MM-DD (local)
  horario: string; // HH:mm (local)
  startIso: string;
  endIso: string | null;
  subject: string;
  description: string | null;
  /** `meeting_outcome` da Sellflux (lido por GET /:id) ou ❌ no título. Só `cancelado` libera vagas. */
  status: StatusReserva;
  /** valor cru de `meeting_outcome`, para diagnóstico */
  outcome: string | null;
  cancelado: boolean;
  leadIds: number[];
};

export type Slot = {
  horario: string;
  fim: string;
  capacidade: number;
  ocupacao: number;
  vagas: number;
  reservas: Reserva[];
};

export const DIAS_SEMANA_LABEL: Record<DiaSemana, string> = {
  "0": "Domingo",
  "1": "Segunda",
  "2": "Terça",
  "3": "Quarta",
  "4": "Quinta",
  "5": "Sexta",
  "6": "Sábado",
};

export function horariosVazios(): Horarios {
  return { "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] };
}

/** Horários de início das baterias de uma unidade num dia (`YYYY-MM-DD`). */
export function gerarHorarios(unidade: Unidade, data: string): string[] {
  const dia = String(diaDaSemana(data)) as DiaSemana;
  const intervalos = unidade.horarios[dia] ?? [];
  const out: string[] = [];
  for (const { inicio, fim } of intervalos) {
    let h: string | null = inicio;
    while (h && minutosDoDia(h) + unidade.duracaoMin <= minutosDoDia(fim)) {
      out.push(h);
      h = somarMinutos(h, unidade.duracaoMin);
    }
  }
  return [...new Set(out)].sort();
}

/** Slot da grade em que um horário cai (o slot cujo início é ≤ horário < início + duração). */
function slotDe(horarios: string[], duracaoMin: number, horario: string): string | null {
  const m = minutosDoDia(horario);
  for (const h of horarios) {
    const inicio = minutosDoDia(h);
    if (m >= inicio && m < inicio + duracaoMin) return h;
  }
  return null;
}

/**
 * Monta a grade do dia com ocupação. Reservas canceladas não ocupam.
 * Reservas fora da grade (horário fechado) são devolvidas em `foraDaGrade` para não sumirem da tela.
 */
export function montarGrade(unidade: Unidade, data: string, reservas: Reserva[]): { slots: Slot[]; foraDaGrade: Reserva[] } {
  const horarios = gerarHorarios(unidade, data);
  const porSlot = new Map<string, Reserva[]>(horarios.map((h) => [h, []]));
  const foraDaGrade: Reserva[] = [];

  for (const r of reservas) {
    if (r.data !== data) continue;
    const slot = slotDe(horarios, unidade.duracaoMin, r.horario);
    if (slot) porSlot.get(slot)!.push(r);
    else foraDaGrade.push(r);
  }

  const slots = horarios.map((horario) => {
    const rs = porSlot.get(horario)!.sort((a, b) => a.horario.localeCompare(b.horario) || a.nome.localeCompare(b.nome));
    const ocupacao = rs.filter((r) => !r.cancelado).reduce((acc, r) => acc + r.pessoas, 0);
    return {
      horario,
      fim: somarMinutos(horario, unidade.duracaoMin) ?? "23:59",
      capacidade: unidade.capacidade,
      ocupacao,
      vagas: Math.max(0, unidade.capacidade - ocupacao),
      reservas: rs,
    };
  });

  return { slots, foraDaGrade };
}

/** Vagas num horário específico, ignorando opcionalmente uma reserva (caso de edição). */
export function vagasEm(grade: Slot[], horario: string, ignorarId?: Reserva["id"]): number | null {
  const slot = grade.find((s) => s.horario === horario);
  if (!slot) return null;
  if (ignorarId === undefined) return slot.vagas;
  const propria = slot.reservas.find((r) => String(r.id) === String(ignorarId) && !r.cancelado);
  return Math.min(slot.capacidade, slot.vagas + (propria?.pessoas ?? 0));
}

/** Slots com vaga ≥ pessoas — usado nas alternativas do 409 e no filtro da tela. */
export function slotsQueCabem(grade: Slot[], pessoas: number): Slot[] {
  return grade.filter((s) => s.vagas >= pessoas);
}

/** Converte start/end ISO em campos locais da reserva. */
export function localDe(startIso: string) {
  return utcToLocal(startIso);
}
