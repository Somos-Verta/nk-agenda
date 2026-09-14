"use client";

import { AlertTriangleIcon } from "lucide-react";
import type { Reserva, Slot } from "@/lib/slots";
import { cn } from "@/lib/utils";

function tom(slot: Slot) {
  if (slot.vagas === 0) return { borda: "border-red-300 dark:border-red-900", barra: "bg-red-500", texto: "text-red-700 dark:text-red-400" };
  if (slot.vagas < slot.capacidade / 2) return { borda: "border-amber-300 dark:border-amber-900", barra: "bg-amber-500", texto: "text-amber-700 dark:text-amber-400" };
  return { borda: "border-emerald-300 dark:border-emerald-900", barra: "bg-emerald-500", texto: "text-emerald-700 dark:text-emerald-400" };
}

export function SlotCard({ slot, filtroPessoas, onNova, onAbrir }: {
  slot: Slot;
  filtroPessoas: number | null;
  onNova: (horario: string) => void;
  onAbrir: (r: Reserva) => void;
}) {
  const t = tom(slot);
  const cabe = filtroPessoas === null || slot.vagas >= filtroPessoas;
  const pct = Math.min(100, Math.round((slot.ocupacao / slot.capacidade) * 100));
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border-2 bg-card p-3 transition-opacity", t.borda, !cabe && "opacity-35")}>
      <button type="button" onClick={() => onNova(slot.horario)} className="text-left" title="Nova reserva neste horário">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold tabular-nums">{slot.horario}</span>
          <span className={cn("text-sm font-medium tabular-nums", t.texto)}>
            {slot.vagas === 0 ? "Lotado" : `${slot.vagas} vaga${slot.vagas === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", t.barra)} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-xs text-muted-foreground tabular-nums">{slot.ocupacao}/{slot.capacidade} karts</div>
      </button>
      {slot.reservas.length > 0 && (
        <ul className="flex flex-col gap-1">
          {slot.reservas.map((r) => (
            <li key={String(r.id)}>
              <button
                type="button"
                onClick={() => onAbrir(r)}
                className={cn("flex w-full items-center justify-between rounded-md bg-muted/60 px-2 py-1 text-left text-sm hover:bg-muted", r.cancelado && "line-through opacity-50")}
              >
                <span className="truncate">{r.nome}{r.cancelado && <span className="ml-1 text-xs no-underline">(cancelada)</span>}</span>
                <span className="ml-2 flex shrink-0 items-center gap-1 font-medium tabular-nums">
                  {!r.pessoasIdentificadas && <AlertTriangleIcon className="size-3.5 text-amber-600" aria-label="Quantidade não identificada" />}
                  {r.pessoas}p
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
