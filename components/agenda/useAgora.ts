"use client";

import { useSyncExternalStore } from "react";
import { TZ } from "@/lib/tz";

export type Agora = { data: string; horario: string };

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** `YYYY-MM-DDTHH:mm` no fuso das unidades — string para o snapshot ser comparável por valor. */
function chaveAgora(): string {
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function assinar(cb: () => void) {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
}

/** Data e hora atuais no fuso das unidades, atualizadas a cada 30 s. `null` no servidor e na hidratação. */
export function useAgora(): Agora | null {
  const chave = useSyncExternalStore(assinar, chaveAgora, () => null);
  return chave ? { data: chave.slice(0, 10), horario: chave.slice(11) } : null;
}

/** A bateria (`data` + `fim` HH:mm) já terminou? Datas anteriores a hoje contam inteiras como passadas. */
export function bateriaPassou(data: string, fim: string, agora: Agora | null): boolean {
  if (!agora) return false;
  if (data !== agora.data) return data < agora.data;
  return fim <= agora.horario;
}

/** A bateria está acontecendo agora? */
export function bateriaEmPista(data: string, inicio: string, fim: string, agora: Agora | null): boolean {
  return !!agora && data === agora.data && inicio <= agora.horario && agora.horario < fim;
}
