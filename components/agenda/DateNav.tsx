"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function somarDias(data: string, n: number): string {
  const [y, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function formatarDataLonga(data: string): string {
  const [y, m, d] = data.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function DateNav({ data, hoje, onChange }: { data: string; hoje: string; onChange: (d: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" aria-label="Dia anterior" onClick={() => onChange(somarDias(data, -1))}><ChevronLeftIcon /></Button>
      <Input type="date" value={data} onChange={(e) => e.target.value && onChange(e.target.value)} className="w-40" />
      <Button variant="outline" size="icon" aria-label="Próximo dia" onClick={() => onChange(somarDias(data, 1))}><ChevronRightIcon /></Button>
      <Button variant={data === hoje ? "secondary" : "outline"} size="sm" onClick={() => onChange(hoje)}>Hoje</Button>
    </div>
  );
}
