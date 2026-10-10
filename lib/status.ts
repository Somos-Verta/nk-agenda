/**
 * Status do agendamento ("Andamento" na Sellflux): o que a API aceita hoje e o registro local do resto.
 *
 * A API pública da Sellflux só grava 3 dos 6 status (testado 10/10/2026, ver SELLFLUX-API.md):
 * `status` 1 → Agendada, 2 → Concluído, "cancelado" → Cancelado. Reagendado, Não compareceu e Nenhum não têm
 * como ser gravados. O app guarda o status completo em `nk_reserva_status` e mostra esse; à Sellflux vai só o
 * que ela aceita. Quando a API aceitar os 6: ampliar `statusParaSellflux`, empurrar os registros e aposentar a tabela.
 */
import { z } from "zod";
import { STATUS_RESERVA, type Reserva, type StatusReserva } from "./slots";

export const statusSchema = z.enum(STATUS_RESERVA);

/** Valor de `status` aceito por `PUT /crm/schedules/:id` para mudar o `meeting_outcome`. */
export type ValorStatusSellflux = 1 | 2 | "cancelado";

/**
 * O que enviar à Sellflux para refletir um status. `null` = a API não aceita; fica só no registro do app.
 * É o único lugar a mudar quando a Sellflux passar a aceitar mais status.
 */
export function statusParaSellflux(status: StatusReserva): ValorStatusSellflux | null {
  switch (status) {
    case "agendado": return 1;
    case "concluido": return 2;
    case "cancelado": return "cancelado";
    default: return null;
  }
}

/** Uma linha de `nk_reserva_status`. */
export type StatusLocal = {
  /** id do agendamento na Sellflux */
  id: number | string;
  /** dia da reserva (YYYY-MM-DD, local) — a grade lê o registro do dia numa só consulta */
  data: string;
  status: StatusReserva;
  /** `statusSellflux` da reserva no momento em que o registro foi gravado */
  baseStatus: StatusReserva;
};

/**
 * Sobrepõe o status do registro local ao da Sellflux.
 *
 * O registro só vale enquanto a Sellflux continua como estava quando ele foi gravado (`baseStatus`):
 * se alguém mudou o andamento direto lá desde então, a Sellflux manda e o registro fica ignorado
 * (ele volta a valer na próxima gravação pelo app). Assim o registro nunca esconde uma mudança feita na Sellflux.
 */
export function aplicarStatusLocal(reservas: Reserva[], locais: StatusLocal[]): Reserva[] {
  if (locais.length === 0) return reservas;
  const porId = new Map(locais.map((l) => [String(l.id), l]));
  return reservas.map((r) => {
    const l = porId.get(String(r.id));
    if (!l || l.baseStatus !== r.statusSellflux) return r;
    return { ...r, status: l.status, cancelado: l.status === "cancelado" };
  });
}

/** A reserva está num status que a Sellflux não mostra (só existe no registro do app). */
export const soNoApp = (r: Pick<Reserva, "status" | "statusSellflux">): boolean => r.status !== r.statusSellflux;
