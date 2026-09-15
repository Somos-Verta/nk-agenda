import { CalendarIcon, CalendarSyncIcon, CircleCheckIcon, CircleXIcon, UserXIcon, type LucideIcon } from "lucide-react";
import { STATUS_LABEL, type StatusReserva } from "@/lib/slots";
import { cn } from "@/lib/utils";

/** Ícone e cor de cada status — a mesma legenda que a equipe já conhece da Sellflux. */
export const STATUS_UI: Record<StatusReserva, { label: string; Icon: LucideIcon; cor: string; fundo: string }> = {
  agendado: { label: STATUS_LABEL.agendado, Icon: CalendarIcon, cor: "text-st-agendado", fundo: "bg-st-agendado" },
  nao_compareceu: { label: STATUS_LABEL.nao_compareceu, Icon: UserXIcon, cor: "text-st-nao-compareceu", fundo: "bg-st-nao-compareceu" },
  reagendado: { label: STATUS_LABEL.reagendado, Icon: CalendarSyncIcon, cor: "text-st-reagendado", fundo: "bg-st-reagendado" },
  concluido: { label: STATUS_LABEL.concluido, Icon: CircleCheckIcon, cor: "text-st-concluido", fundo: "bg-st-concluido" },
  cancelado: { label: STATUS_LABEL.cancelado, Icon: CircleXIcon, cor: "text-st-cancelado", fundo: "bg-st-cancelado" },
};

/** Ordem da legenda (igual à da Sellflux). */
export const STATUS_ORDEM: StatusReserva[] = ["agendado", "nao_compareceu", "reagendado", "concluido", "cancelado"];

export function StatusIcon({ status, className }: { status: StatusReserva; className?: string }) {
  const { Icon, cor, label } = STATUS_UI[status];
  return <Icon className={cn("size-4 shrink-0", cor, className)} aria-label={label} />;
}

/** Ícone + texto colorido, para cabeçalhos e legenda. */
export function StatusTag({ status, className }: { status: StatusReserva; className?: string }) {
  const { Icon, cor, label } = STATUS_UI[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", cor, className)}>
      <Icon className="size-3.5" aria-hidden /> {label}
    </span>
  );
}
