"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function somarDias(data: string, n: number): string {
  const [y, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** "segunda-feira, 14 de setembro" */
export function formatarDataLonga(data: string): string {
  const [y, m, d] = data.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "seg, 14/09" */
function formatarDataCurta(data: string): string {
  const [y, m, d] = data.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d))).replace(".", "");
}

const seta = "grid w-8 place-items-center text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted [&_svg]:size-4";

export function DateNav({ data, hoje, onChange }: { data: string; hoje: string; onChange: (d: string) => void }) {
  const ehHoje = data === hoje;
  return (
    <div className="flex items-center gap-1">
      <div className="inline-flex h-8 items-stretch overflow-hidden rounded-lg border border-input bg-background">
        <button type="button" className={seta} aria-label="Dia anterior" onClick={() => onChange(somarDias(data, -1))}><ChevronLeftIcon /></button>
        {/* o input de data fica invisível por cima do rótulo: clique abre o calendário nativo, teclado continua funcionando */}
        <span className="relative flex items-center border-x border-input px-2.5 text-sm font-medium capitalize tabular-nums focus-within:bg-muted hover:bg-muted">
          {formatarDataCurta(data)}
          <input
            type="date"
            value={data}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            onClick={(e) => { try { e.currentTarget.showPicker(); } catch { /* navegador sem showPicker: abre do jeito dele */ } }}
            aria-label="Escolher data"
            className="absolute inset-0 w-full cursor-pointer opacity-0"
          />
        </span>
        <button type="button" className={seta} aria-label="Próximo dia" onClick={() => onChange(somarDias(data, 1))}><ChevronRightIcon /></button>
      </div>
      <Button variant={ehHoje ? "secondary" : "outline"} size="sm" className={cn("h-8", ehHoje && "pointer-events-none")} onClick={() => onChange(hoje)} aria-pressed={ehHoje}>Hoje</Button>
    </div>
  );
}
