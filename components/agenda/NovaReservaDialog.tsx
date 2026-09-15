"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api-client";
import type { Grade } from "@/lib/agenda";
import { validarTelefone } from "@/lib/parse";
import type { Reserva } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { formatarDataLonga } from "./DateNav";
import { HorarioPicker } from "./HorarioPicker";
import { RingVagas } from "./RingVagas";
import { PessoasStepper } from "./PessoasStepper";
import { TelefoneInput } from "./TelefoneInput";
import { bateriaPassou, type Agora } from "./useAgora";

type Alternativa = { horario: string; vagas: number };

export function NovaReservaDialog({ grade, horarioInicial, agora, onClose, onCriada, onConflito }: {
  grade: Grade;
  horarioInicial: string | null;
  /** hora atual no fuso das unidades — para avisar quando a bateria escolhida já passou */
  agora: Agora | null;
  onClose: () => void;
  onCriada: (r: Reserva) => void;
  /** a vaga mudou no servidor (409): o pai recarrega a grade e este diálogo passa a mostrar as vagas reais */
  onConflito?: () => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pessoas, setPessoas] = useState("1");
  const [horario, setHorario] = useState<string>(horarioInicial ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [alternativas, setAlternativas] = useState<Alternativa[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [confirmarPassado, setConfirmarPassado] = useState(false);

  const n = Math.max(1, Number(pessoas) || 1);
  const telefoneOk = validarTelefone(telefone).ok;
  const slot = grade.slots.find((s) => s.horario === horario);
  const cabe = slot ? slot.vagas >= n : false;
  const algumaCabe = grade.slots.some((s) => s.vagas >= n);
  const passados = new Set(grade.slots.filter((s) => bateriaPassou(grade.data, s.fim, agora)).map((s) => s.horario));
  const dataPassada = !!agora && grade.data < agora.data;
  const noPassado = !!slot && passados.has(slot.horario);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    // horário que já passou: pede confirmação antes de gravar
    if (noPassado && !confirmarPassado) { setConfirmarPassado(true); return; }
    void criar();
  }

  async function criar() {
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
        if (err.status === 409) onConflito?.();
      } else setErro(String(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <form onSubmit={enviar} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Nova reserva</DialogTitle>
            <DialogDescription className="first-letter:uppercase">{grade.unidade.nome} · {formatarDataLonga(grade.data)}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Quem está reservando" required />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="grid gap-2">
              <Label htmlFor="telefone">Telefone</Label>
              <TelefoneInput id="telefone" value={telefone} onChange={setTelefone} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pessoas">Pessoas</Label>
              <PessoasStepper id="pessoas" value={pessoas} onChange={setPessoas} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Bateria</Label>
            <HorarioPicker slots={grade.slots} value={horario} onChange={(h) => { setHorario(h); setErro(null); setConfirmarPassado(false); }} pessoas={n} passados={passados} />
            {slot ? (
              <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2.5 py-2 text-sm", cabe ? "bg-livre-soft" : "bg-lotado-soft")}>
                <RingVagas capacidade={slot.capacidade} ocupacao={slot.ocupacao} previsto={cabe ? n : 0} tamanho={36} />
                <span className={cn("font-medium", cabe ? "text-livre" : "text-lotado")}>
                  {cabe
                    ? `${slot.horario}: ficam ${slot.vagas - n} vaga${slot.vagas - n === 1 ? "" : "s"} depois desta reserva`
                    : `${slot.horario} tem só ${slot.vagas} vaga${slot.vagas === 1 ? "" : "s"} — não cabem ${n}`}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{algumaCabe ? "Escolha a bateria." : `Nenhuma bateria com ${n} vaga${n === 1 ? "" : "s"} neste dia.`}</p>
            )}
          </div>

          {noPassado && (
            <div className="rounded-md border border-enchendo/40 bg-enchendo-soft p-3 text-sm">
              <p className="font-medium">{dataPassada ? "Esta data já passou." : `A bateria ${slot?.horario} já passou.`}</p>
              <p className="text-muted-foreground">A reserva vai entrar na Sellflux num horário que já aconteceu.</p>
              {confirmarPassado && (
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" className="bg-ink text-ink-foreground hover:bg-ink/85" onClick={() => void criar()} disabled={enviando}>{enviando ? "Reservando…" : "Sim, reservar mesmo assim"}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmarPassado(false)}>Voltar</Button>
                </div>
              )}
            </div>
          )}

          {erro && (
            <div className="rounded-md border border-lotado/40 bg-lotado-soft p-3 text-sm">
              <p>{erro}</p>
              {alternativas.length > 0 && (
                <>
                  <p className="mt-1 text-muted-foreground">Baterias que ainda cabem {n}:</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {alternativas.map((a) => (
                      <Button key={a.horario} type="button" size="sm" variant="outline" onClick={() => { setHorario(a.horario); setErro(null); }}>{a.horario} · {a.vagas}</Button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-ink text-ink-foreground hover:bg-ink/85" disabled={enviando || !horario || !cabe || !nome || !telefoneOk || confirmarPassado}>
              {enviando ? "Reservando…" : slot ? `Reservar ${n}p às ${slot.horario}` : "Reservar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
