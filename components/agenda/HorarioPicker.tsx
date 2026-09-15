"use client";

import type { Slot } from "@/lib/slots";
import { cn } from "@/lib/utils";

/**
 * Baterias do dia como chips, com as vagas de cada uma à vista — a atendente escolhe olhando, sem abrir dropdown.
 * Chips onde não cabem `pessoas` ficam desabilitados (a atual, na edição, continua clicável).
 */
export function HorarioPicker({ slots, value, onChange, pessoas, atual, passados }: {
  slots: Slot[];
  value: string;
  onChange: (h: string) => void;
  pessoas: number;
  /** horário da reserva em edição: sempre selecionável, mostra "atual" */
  atual?: string;
  /** baterias que já passaram: continuam selecionáveis, mas esmaecidas (quem escolhe confirma depois) */
  passados?: Set<string>;
}) {
  if (slots.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma bateria neste dia.</p>;
  return (
    <div role="radiogroup" aria-label="Bateria" className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
      {slots.map((s) => {
        const ehAtual = s.horario === atual;
        const cabe = ehAtual || s.vagas >= pessoas;
        const on = s.horario === value;
        const passou = passados?.has(s.horario) ?? false;
        return (
          <button
            key={s.horario}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={!cabe}
            onClick={() => onChange(s.horario)}
            aria-label={`${s.horario}, ${ehAtual ? "bateria atual" : s.vagas === 0 ? "lotada" : `${s.vagas} vaga${s.vagas === 1 ? "" : "s"}`}${passou ? ", já passou" : ""}`}
            title={!cabe ? `Só ${s.vagas} vaga${s.vagas === 1 ? "" : "s"} — não cabem ${pessoas}` : passou ? "Esta bateria já passou" : undefined}
            className={cn(
              "flex flex-col items-center rounded-md border px-1 py-1 leading-tight outline-none transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "border-ink bg-ink text-ink-foreground" : "border-border bg-background hover:border-foreground/40",
              passou && !on && "opacity-50",
              !cabe && "opacity-35 hover:border-border",
            )}
          >
            <span className="text-sm font-semibold tabular-nums">{s.horario}</span>
            <span className={cn("text-[11px] tabular-nums", on ? "text-ink-foreground/75" : "text-muted-foreground")}>
              {ehAtual ? "atual" : s.vagas === 0 ? "lotada" : `${s.vagas} vaga${s.vagas === 1 ? "" : "s"}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
