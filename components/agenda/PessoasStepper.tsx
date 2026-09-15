"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Campo numérico com − / + (rápido no balcão). `value` vazio = sem valor (usado no filtro). */
export function PessoasStepper({ id, value, onChange, min = 1, max = 200, className, "aria-label": ariaLabel }: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const n = Number(value);
  const tem = value !== "" && Number.isFinite(n);
  const passo = (d: number) => onChange(String(Math.min(max, Math.max(min, (tem ? n : min - 1) + d))));
  const botao = "grid w-8 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent outline-none focus-visible:bg-muted";
  return (
    <div className={cn("inline-flex h-8 items-stretch overflow-hidden rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50", className)}>
      <button type="button" className={botao} onClick={() => passo(-1)} disabled={!tem || n <= min} aria-label="Menos uma pessoa" tabIndex={-1}><MinusIcon className="size-3.5" /></button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        placeholder="—"
        className="w-11 border-x border-input bg-transparent text-center text-base font-semibold tabular-nums outline-none [appearance:textfield] placeholder:font-normal placeholder:text-muted-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" className={botao} onClick={() => passo(1)} disabled={tem && n >= max} aria-label="Mais uma pessoa" tabIndex={-1}><PlusIcon className="size-3.5" /></button>
    </div>
  );
}
