"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type Tom = "livre" | "enchendo" | "lotado";

/** Semáforo da bateria: lotada, menos da metade livre, ou livre. */
export function tomDeVagas(vagas: number, capacidade: number): Tom {
  if (vagas <= 0) return "lotado";
  if (vagas < capacidade / 2) return "enchendo";
  return "livre";
}

const COR_TOM: Record<Tom, string> = { livre: "text-livre", enchendo: "text-enchendo", lotado: "text-lotado" };

/** Acima disso os traços ficam finos demais; o anel vira contínuo. */
const MAX_SEGMENTOS = 30;

/**
 * Anel segmentado em volta do número de vagas: cada traço é um kart da bateria; os coloridos estão reservados.
 * `previsto` desenha, em tinta, os karts de uma reserva que ainda vai ser feita (pré-visualização no diálogo).
 */
export function RingVagas({ capacidade, ocupacao, previsto = 0, apagado = false, tamanho = 44, className }: {
  capacidade: number;
  ocupacao: number;
  previsto?: number;
  /** bateria que já passou: tudo em cinza */
  apagado?: boolean;
  tamanho?: number;
  className?: string;
}) {
  const n = Math.max(1, capacidade);
  const vagas = Math.max(0, n - ocupacao - previsto);
  const tom = tomDeVagas(n - ocupacao - previsto, n);
  const excedente = Math.max(0, ocupacao + previsto - n);
  const grosso = tamanho >= 48 ? 5 : tamanho >= 40 ? 4 : 3;
  const r = (tamanho - grosso) / 2;
  const C = 2 * Math.PI * r;
  const segmentado = n <= MAX_SEGMENTOS;
  const gap = segmentado ? Math.min(2, C / n / 3) : 0;
  const seg = C / n - gap;
  // k traços cheios a partir do topo: [seg gap]×k e depois um vazio que cobre o resto do círculo
  const tracos = (k: number) => (segmentado ? [...Array(Math.max(0, Math.min(n, k)))].flatMap(() => [seg, gap]).concat([0, C]).join(" ") : `${(C * Math.min(n, k)) / n} ${C}`);
  const k1 = Math.min(n, ocupacao);
  const k2 = Math.min(n, ocupacao + previsto);
  const rotulo = `${vagas} vaga${vagas === 1 ? "" : "s"} de ${n}` + (previsto ? ` depois desta reserva` : "") + (excedente ? ` — ${excedente} pessoa${excedente === 1 ? "" : "s"} a mais que karts` : "");
  return (
    <Tooltip>
      <TooltipTrigger delay={150} render={<span tabIndex={0} className={cn("relative inline-grid shrink-0 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)} style={{ width: tamanho, height: tamanho }} role="img" aria-label={rotulo} />}>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} className="absolute inset-0" aria-hidden>
        <g transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`} fill="none" strokeWidth={grosso}>
          <circle cx={tamanho / 2} cy={tamanho / 2} r={r} stroke="currentColor" className="text-foreground/12" strokeDasharray={segmentado ? `${seg} ${gap}` : undefined} />
          {k2 > k1 && <circle cx={tamanho / 2} cy={tamanho / 2} r={r} stroke="currentColor" className={apagado ? "text-muted-foreground" : "text-ink"} strokeDasharray={tracos(k2)} />}
          {k1 > 0 && <circle cx={tamanho / 2} cy={tamanho / 2} r={r} stroke="currentColor" className={apagado ? "text-muted-foreground/70" : COR_TOM[tom]} strokeDasharray={tracos(k1)} />}
        </g>
      </svg>
      <span className={cn("relative font-bold leading-none tabular-nums", tamanho >= 48 ? "text-base" : tamanho >= 40 ? "text-sm" : "text-xs", apagado ? "text-muted-foreground" : COR_TOM[tom])}>{vagas}</span>
      {excedente > 0 && (
        <span className="absolute -top-1 -right-1.5 rounded-full bg-lotado px-1 text-[9px] font-bold leading-4 text-white tabular-nums">+{excedente}</span>
      )}
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-semibold tabular-nums">
          {previsto ? `Ficam ${vagas} vaga${vagas === 1 ? "" : "s"} de ${n} depois desta reserva` : `${vagas} vaga${vagas === 1 ? "" : "s"} de ${n} karts`}
        </p>
        <p className="text-ink-foreground/75">
          Cada traço do anel é um kart; os coloridos já estão reservados{previsto ? " e os azuis são esta reserva" : ""}.
          {excedente > 0 && ` Há ${excedente} pessoa${excedente === 1 ? "" : "s"} a mais que karts.`}
          {apagado && " Bateria já passou."}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
