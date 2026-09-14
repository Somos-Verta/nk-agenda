import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** Fuso único do sistema: todas as unidades operam em horário de Brasília. */
export const TZ = "America/Sao_Paulo";

/** `2026-09-14` + `20:00` (horário local) → ISO UTC (`2026-09-14T23:00:00.000Z`). */
export function localToUtcIso(data: string, horario: string): string {
  return fromZonedTime(`${data}T${horario}:00`, TZ).toISOString();
}

/** ISO/Date (qualquer fuso) → `{ data: 'YYYY-MM-DD', horario: 'HH:mm' }` no fuso local. */
export function utcToLocal(iso: string | Date): { data: string; horario: string } {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return {
    data: formatInTimeZone(d, TZ, "yyyy-MM-dd"),
    horario: formatInTimeZone(d, TZ, "HH:mm"),
  };
}

/** Data de hoje no fuso local, `YYYY-MM-DD`. */
export function hojeLocal(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
}

/** `2026-09-14` → `14/09` (formato usado na descrição do agendamento). */
export function dataCurta(data: string): string {
  const [, m, d] = data.split("-");
  return `${d}/${m}`;
}

/** Dia da semana (0 = domingo … 6 = sábado) de uma data `YYYY-MM-DD`, sem depender do fuso do servidor. */
export function diaDaSemana(data: string): number {
  const [y, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Soma minutos a um horário `HH:mm`. Retorna `null` se passar de 23:59. */
export function somarMinutos(horario: string, minutos: number): string | null {
  const [h, m] = horario.split(":").map(Number);
  const total = h * 60 + m + minutos;
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function minutosDoDia(horario: string): number {
  const [h, m] = horario.split(":").map(Number);
  return h * 60 + m;
}
