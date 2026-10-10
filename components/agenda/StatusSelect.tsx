"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_RESERVA, type StatusReserva } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { STATUS_UI } from "./status";

function Opcao({ status }: { status: StatusReserva }) {
  const { Icon, cor, label } = STATUS_UI[status];
  return <span className="inline-flex items-center gap-2"><Icon className={cn("size-4 shrink-0", cor)} aria-hidden />{label}</span>;
}

/** O campo "Andamento": os mesmos 6 status do dropdown da Sellflux, na mesma ordem. */
export function StatusSelect({ id, value, onChange, disabled, excluir }: {
  id?: string;
  value: StatusReserva;
  onChange: (s: StatusReserva) => void;
  disabled?: boolean;
  /** status que não fazem sentido aqui (ex.: Cancelado numa reserva nova) */
  excluir?: StatusReserva[];
}) {
  const opcoes = STATUS_RESERVA.filter((s) => !excluir?.includes(s));
  const itens = Object.fromEntries(opcoes.map((s) => [s, <Opcao key={s} status={s} />]));
  return (
    <Select value={value} onValueChange={(v) => { if (v) onChange(v as StatusReserva); }} items={itens} disabled={disabled}>
      <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>{opcoes.map((s) => <SelectItem key={s} value={s}><Opcao status={s} /></SelectItem>)}</SelectContent>
    </Select>
  );
}
