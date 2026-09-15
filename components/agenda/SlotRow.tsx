"use client";

import { PlusIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Reserva, Slot } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { RingVagas, tomDeVagas } from "./RingVagas";
import { STATUS_UI, StatusIcon } from "./status";

/** Uma reserva por linha: ícone de status, nome, pessoas, status — como a lista de eventos de um calendário. */
export function ReservaLinha({ r, horario, onClick }: { r: Reserva; /** mostra o horário antes do nome (fora da grade) */ horario?: boolean; onClick: () => void }) {
  const st = STATUS_UI[r.status];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md py-1.5 pr-3 pl-1 text-left text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <StatusIcon status={r.status} />
      <span className={cn("min-w-0 truncate", r.cancelado && "text-muted-foreground line-through")}>
        {horario && <span className="mr-2 font-semibold tabular-nums">{r.horario}</span>}
        <span className="font-medium">{r.nome}</span>
      </span>
      {r.pessoasIdentificadas ? (
        <span className={cn("shrink-0 tabular-nums", r.cancelado ? "text-muted-foreground" : "text-foreground")}>
          <span className="font-semibold">{r.pessoas}</span> <span className="text-muted-foreground">pessoa{r.pessoas === 1 ? "" : "s"}</span>
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 text-enchendo" title="Sem quantidade no título — contando como 1. Abra para ajustar.">
          <TriangleAlertIcon className="size-3.5" aria-hidden />
          <span className="font-semibold tabular-nums">1</span> <span className="hidden md:inline">sem quantidade</span>
        </span>
      )}
      <span className={cn("ml-auto hidden shrink-0 text-xs font-medium sm:inline", st.cor)}>{st.label}</span>
    </button>
  );
}

/** id do elemento da bateria na página (âncora dos avisos do topo). */
export function idDaBateria(horario: string): string {
  return `bateria-${horario.replace(":", "")}`;
}

/** Bloco de uma bateria: horário na margem esquerda; à direita a ocupação e, abaixo, uma linha por reserva. */
export function SlotRow({ slot, passado, emPista, onNova, onAbrir }: {
  slot: Slot;
  /** já terminou: fica esmaecida, mas ainda dá para reservar (com confirmação) */
  passado: boolean;
  /** está acontecendo agora */
  emPista: boolean;
  onNova: (horario: string) => void;
  onAbrir: (r: Reserva) => void;
}) {
  const tom = tomDeVagas(slot.vagas, slot.capacidade);
  const podeReservar = slot.vagas > 0;
  return (
    <li
      id={idDaBateria(slot.horario)}
      data-tom={tom}
      className={cn(
        "grid scroll-mt-4 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 border-b py-2 transition-opacity last:border-b-0 sm:gap-x-5",
        passado && "opacity-45",
      )}
    >
      {/* horário + anel de vagas: o que a atendente lê primeiro */}
      <div className="flex items-center gap-3 pl-3 sm:pl-4">
        <div className="flex w-14 flex-col leading-none">
          <span className="text-lg font-semibold tabular-nums">{slot.horario}</span>
          <span className="mt-1 text-xs text-muted-foreground tabular-nums">até {slot.fim}</span>
          {emPista && <span className="mt-1.5 text-[10px] font-semibold text-agora">em pista</span>}
        </div>
        <RingVagas capacidade={slot.capacidade} ocupacao={slot.ocupacao} apagado={passado} tamanho={48} />
      </div>

      {/* reservas da bateria */}
      <div className="min-w-0">
        {slot.reservas.length > 0 && (
          <ul className="flex flex-col">
            {slot.reservas.map((r) => (
              <li key={String(r.id)}><ReservaLinha r={r} onClick={() => onAbrir(r)} /></li>
            ))}
          </ul>
        )}
      </div>

      {/* ação: seção própria, separada das reservas */}
      <div className="flex h-full min-w-11 items-center border-l pr-3 pl-3 sm:min-w-32 sm:pr-4 sm:pl-4">
        {podeReservar && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onNova(slot.horario)}
            title={passado ? `Reservar às ${slot.horario} (bateria já passou)` : `Reservar às ${slot.horario}`}
          >
            <PlusIcon data-icon="inline-start" />
            <span className="sr-only sm:not-sr-only">Reservar</span>
          </Button>
        )}
      </div>
    </li>
  );
}
