"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, ApiError } from "@/lib/api-client";
import type { Grade } from "@/lib/agenda";
import { STATUS_LABEL, type Reserva } from "@/lib/slots";
import { formatarTelefone } from "@/lib/parse";

export function ReservaSheet({ grade, reserva, onClose, onAlterada }: {
  grade: Grade;
  reserva: Reserva;
  onClose: () => void;
  onAlterada: () => void;
}) {
  const [nome, setNome] = useState(reserva.nome);
  const [telefone, setTelefone] = useState(reserva.telefone ? formatarTelefone(reserva.telefone) : "");
  const [pessoas, setPessoas] = useState(String(reserva.pessoas));
  const [horario, setHorario] = useState(reserva.horario);
  const [salvando, setSalvando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const n = Math.max(1, Number(pessoas) || 1);
  const opcoes = grade.slots.filter((s) => s.horario === reserva.horario || s.vagas >= n);
  const mudou = nome !== reserva.nome || n !== reserva.pessoas || horario !== reserva.horario || (telefone && (!reserva.telefone || telefone !== formatarTelefone(reserva.telefone)));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const patch: Record<string, unknown> = { unidade: grade.unidade.slug };
      if (nome !== reserva.nome) patch.nome = nome;
      if (n !== reserva.pessoas) patch.pessoas = n;
      if (horario !== reserva.horario) { patch.horario = horario; patch.data = grade.data; }
      if (telefone && (!reserva.telefone || telefone !== formatarTelefone(reserva.telefone))) patch.telefone = telefone;
      await api(`/api/agenda/${reserva.id}`, { method: "PUT", json: patch });
      toast.success("Reserva atualizada.");
      onAlterada();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  async function cancelar() {
    setErro(null);
    setCancelando(true);
    try {
      await api(`/api/agenda/${reserva.id}?unidade=${grade.unidade.slug}`, { method: "DELETE" });
      toast.success(`Reserva de ${reserva.nome} cancelada.`);
      onAlterada();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : String(err));
      setConfirmar(false);
    } finally {
      setCancelando(false);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {reserva.nome} <Badge variant="secondary">{reserva.pessoas}p</Badge>
            <Badge variant={reserva.cancelado ? "destructive" : "outline"}>{STATUS_LABEL[reserva.status]}</Badge>
          </SheetTitle>
          <SheetDescription>{grade.unidade.nome} · {grade.data.split("-").reverse().join("/")} às {reserva.horario}</SheetDescription>
        </SheetHeader>

        {!reserva.pessoasIdentificadas && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm dark:bg-amber-950/30">
            Este agendamento não segue o padrão &quot;Nome Np&quot; (foi criado direto na Sellflux). Está contando como 1 pessoa — ajuste abaixo.
          </p>
        )}

        {reserva.description && (
          <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-sans text-sm">{reserva.description}</pre>
        )}

        {!reserva.cancelado && (
          <form onSubmit={salvar} className="grid gap-3 px-1">
            <Separator />
            <div className="grid gap-2">
              <Label htmlFor="e-nome">Nome</Label>
              <Input id="e-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="e-tel">Telefone</Label>
                <Input id="e-tel" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="62 98765-4321" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e-pessoas">Pessoas</Label>
                <Input id="e-pessoas" type="number" min={1} value={pessoas} onChange={(e) => setPessoas(e.target.value)} required />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Horário</Label>
              <Select value={horario} onValueChange={(v) => setHorario(String(v ?? reserva.horario))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {opcoes.map((s) => (
                    <SelectItem key={s.horario} value={s.horario}>{s.horario} — {s.horario === reserva.horario ? "atual" : `${s.vagas} vaga${s.vagas === 1 ? "" : "s"}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" disabled={!mudou || salvando}>{salvando ? "Salvando…" : "Salvar alterações"}</Button>
          </form>
        )}

        {!reserva.cancelado && (
          <SheetFooter className="mt-auto">
            {confirmar ? (
              <div className="flex w-full flex-col gap-2">
                <p className="text-sm">Cancelar a reserva de <strong>{reserva.nome}</strong>? Libera {reserva.pessoas} kart{reserva.pessoas === 1 ? "" : "s"} às {reserva.horario}.</p>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={cancelar} disabled={cancelando}>{cancelando ? "Cancelando…" : "Sim, cancelar"}</Button>
                  <Button variant="ghost" onClick={() => setConfirmar(false)}>Voltar</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="text-destructive" onClick={() => setConfirmar(true)}>Cancelar reserva</Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
