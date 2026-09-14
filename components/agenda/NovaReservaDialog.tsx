"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api-client";
import type { Grade } from "@/lib/agenda";
import type { Reserva } from "@/lib/slots";

type Alternativa = { horario: string; vagas: number };

export function NovaReservaDialog({ grade, horarioInicial, pessoasIniciais, onClose, onCriada }: {
  grade: Grade;
  horarioInicial: string | null;
  pessoasIniciais: number | null;
  onClose: () => void;
  onCriada: (r: Reserva) => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pessoas, setPessoas] = useState(pessoasIniciais ? String(pessoasIniciais) : "1");
  const [horario, setHorario] = useState<string>(horarioInicial ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [alternativas, setAlternativas] = useState<Alternativa[]>([]);
  const [enviando, setEnviando] = useState(false);

  const n = Math.max(1, Number(pessoas) || 1);
  const slot = grade.slots.find((s) => s.horario === horario);
  const opcoes = useMemo(() => grade.slots.filter((s) => s.vagas >= n || s.horario === horarioInicial), [grade, n, horarioInicial]);
  const cabe = slot ? slot.vagas >= n : false;

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAlternativas([]);
    setEnviando(true);
    try {
      const r = await api<Reserva>("/api/agenda", { method: "POST", json: { unidade: grade.unidade.slug, data: grade.data, horario, nome, telefone, pessoas: n } });
      onCriada(r);
    } catch (err) {
      if (err instanceof ApiError) {
        setErro(err.message);
        if (Array.isArray(err.payload.alternativas)) setAlternativas(err.payload.alternativas as Alternativa[]);
      } else setErro(String(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <form onSubmit={criar} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Nova reserva · {grade.unidade.nome}</DialogTitle>
            <DialogDescription>{grade.data.split("-").reverse().join("/")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Fulano" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="62 98765-4321" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pessoas">Pessoas</Label>
              <Input id="pessoas" type="number" min={1} inputMode="numeric" value={pessoas} onChange={(e) => setPessoas(e.target.value)} required />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Horário</Label>
            <Select value={horario} onValueChange={(v) => setHorario(String(v ?? ""))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Escolha a bateria" /></SelectTrigger>
              <SelectContent>
                {opcoes.map((s) => (
                  <SelectItem key={s.horario} value={s.horario}>{s.horario} — {s.vagas} vaga{s.vagas === 1 ? "" : "s"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {slot && (
              <p className={cabe ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
                {cabe ? `${slot.vagas} vaga${slot.vagas === 1 ? "" : "s"} neste horário.` : `Só ${slot.vagas} vaga${slot.vagas === 1 ? "" : "s"} neste horário — não cabem ${n}.`}
              </p>
            )}
            {opcoes.length === 0 && <p className="text-sm text-destructive">Nenhuma bateria com {n} vaga{n === 1 ? "" : "s"} neste dia.</p>}
          </div>

          {erro && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p>{erro}</p>
              {alternativas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {alternativas.map((a) => (
                    <Button key={a.horario} type="button" size="sm" variant="outline" onClick={() => { setHorario(a.horario); setErro(null); }}>{a.horario} ({a.vagas})</Button>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={enviando || !horario || !cabe || !nome || !telefone}>{enviando ? "Reservando…" : "Reservar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
