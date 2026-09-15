"use client";

import { CalendarDaysIcon, MessageSquareTextIcon, UserRoundIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, ApiError } from "@/lib/api-client";
import type { Grade } from "@/lib/agenda";
import type { VinculosSchedule } from "@/lib/sellflux";
import { urlAgendaSellflux, urlChatSellflux, urlLeadSellflux } from "@/lib/links";
import { formatarTelefone, mascararTelefone, validarTelefone } from "@/lib/parse";
import type { Reserva } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { formatarDataLonga } from "./DateNav";
import { HorarioPicker } from "./HorarioPicker";
import { PessoasStepper } from "./PessoasStepper";
import { TelefoneInput } from "./TelefoneInput";
import { STATUS_UI, StatusIcon } from "./status";
import { bateriaPassou, type Agora } from "./useAgora";

const LINK_SELLFLUX = "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/** O que cada status significa para a vaga — a regra que mais confunde no balcão. */
function efeitoDoStatus(r: Reserva): { texto: string; tom: "neutro" | "aviso" | "livre" } {
  const karts = `${r.pessoas} kart${r.pessoas === 1 ? "" : "s"}`;
  switch (r.status) {
    case "cancelado": return { texto: "Cancelada. Não ocupa kart na bateria.", tom: "livre" };
    case "concluido": return { texto: `Concluída, mas continua ocupando ${karts} — só cancelar libera.`, tom: "aviso" };
    case "nao_compareceu": return { texto: `Não compareceu, mas continua ocupando ${karts} — cancele para liberar.`, tom: "aviso" };
    case "reagendado": return { texto: `Reagendada. Ocupa ${karts} nesta bateria.`, tom: "neutro" };
    default: return { texto: `Ocupa ${karts} nesta bateria.`, tom: "neutro" };
  }
}

export function ReservaSheet({ grade, reserva, agora, onClose, onAlterada }: {
  grade: Grade;
  reserva: Reserva;
  /** hora atual no fuso das unidades — para avisar ao mover para uma bateria que já passou */
  agora: Agora | null;
  onClose: () => void;
  onAlterada: () => void;
}) {
  const [nome, setNome] = useState(reserva.nome);
  const [telefone, setTelefone] = useState(reserva.telefone ? mascararTelefone(reserva.telefone) : "");
  const [pessoas, setPessoas] = useState(String(reserva.pessoas));
  const [horario, setHorario] = useState(reserva.horario);
  const [descricao, setDescricao] = useState(reserva.description ?? "");
  const [salvando, setSalvando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [confirmarPassado, setConfirmarPassado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const n = Math.max(1, Number(pessoas) || 1);
  const telefoneValidado = validarTelefone(telefone);
  const telefoneMudou = telefoneValidado.ok && telefoneValidado.e164 !== reserva.telefone;
  const telefoneInvalido = telefone !== "" && !telefoneValidado.ok;
  const descricaoMudou = descricao.trim() !== (reserva.description ?? "").trim();
  const mudou = nome !== reserva.nome || n !== reserva.pessoas || horario !== reserva.horario || telefoneMudou || descricaoMudou;
  const efeito = efeitoDoStatus(reserva);
  const slotAtual = grade.slots.find((s) => s.horario === reserva.horario);
  // ao mudar de bateria, a própria reserva sai da atual: vagas "reais" para o picker
  const slotsParaPicker = grade.slots.map((s) => (s.horario === reserva.horario && !reserva.cancelado ? { ...s, vagas: Math.min(s.capacidade, s.vagas + reserva.pessoas) } : s));
  const destino = slotsParaPicker.find((s) => s.horario === horario);
  const cabeDestino = destino ? destino.vagas >= n : true;
  const passados = new Set(grade.slots.filter((s) => bateriaPassou(grade.data, s.fim, agora)).map((s) => s.horario));
  // mover para uma bateria que já passou pede confirmação (editar a própria reserva num horário passado, não)
  const moverParaPassado = horario !== reserva.horario && passados.has(horario);
  const linhasDescricao = (reserva.description ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  // lead e chat vêm de uma rota à parte da Sellflux; busca só quando a ficha abre
  const [vinculos, setVinculos] = useState<VinculosSchedule | null>(null);
  const [erroVinculos, setErroVinculos] = useState(false);
  const leadId = vinculos?.leadId ?? reserva.leadIds[0] ?? null;
  const chatId = vinculos?.chatId ?? null;

  useEffect(() => {
    let ativo = true;
    api<VinculosSchedule>(`/api/agenda/${reserva.id}/vinculos?unidade=${grade.unidade.slug}`)
      .then((v) => { if (ativo) setVinculos(v); })
      .catch(() => { if (ativo) setErroVinculos(true); });
    return () => { ativo = false; };
  }, [reserva.id, grade.unidade.slug]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (moverParaPassado && !confirmarPassado) { setConfirmarPassado(true); return; }
    void salvar();
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const patch: Record<string, unknown> = { unidade: grade.unidade.slug };
      if (nome !== reserva.nome) patch.nome = nome;
      if (n !== reserva.pessoas) patch.pessoas = n;
      if (horario !== reserva.horario) { patch.horario = horario; patch.data = grade.data; }
      if (telefoneMudou) patch.telefone = telefone;
      if (descricaoMudou) patch.description = descricao.trim();
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
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader className="gap-1.5">
          <SheetTitle className="flex flex-wrap items-center gap-2 pr-8 text-lg">
            <span className={cn(reserva.cancelado && "text-muted-foreground line-through")}>{reserva.nome}</span>
            <Badge className="bg-ink text-ink-foreground tabular-nums">{reserva.pessoas} pessoa{reserva.pessoas === 1 ? "" : "s"}</Badge>
            <Badge variant="outline" className={cn("gap-1", STATUS_UI[reserva.status].cor)}>
              <StatusIcon status={reserva.status} className="size-3.5" /> {STATUS_UI[reserva.status].label}
            </Badge>
          </SheetTitle>
          <SheetDescription className="first-letter:uppercase">
            {formatarDataLonga(grade.data)} · {reserva.horario} · {grade.unidade.nome}
          </SheetDescription>
          <p className={cn("text-sm", efeito.tom === "aviso" && "text-enchendo", efeito.tom === "livre" && "text-livre", efeito.tom === "neutro" && "text-muted-foreground")}>
            {efeito.texto}
            {slotAtual && !reserva.cancelado && ` A bateria ${slotAtual.horario} está com ${slotAtual.ocupacao} de ${slotAtual.capacidade} karts.`}
          </p>
        </SheetHeader>

        <div className="grid gap-3 px-4 pb-4">
          {!reserva.pessoasIdentificadas && (
            <p className="rounded-md border border-enchendo/40 bg-enchendo-soft p-2.5 text-sm">
              Este agendamento não tem a quantidade no título (foi criado direto na Sellflux). Está contando como <strong>1 pessoa</strong> — ajuste abaixo.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            {reserva.telefone && <span className="tabular-nums">{formatarTelefone(reserva.telefone)}</span>}
            {leadId && (
              <a href={urlLeadSellflux(leadId)} target="_blank" rel="noopener noreferrer" className={LINK_SELLFLUX} title="Abre o lead na Sellflux, na aba de agendamentos">
                <UserRoundIcon className="size-3.5" aria-hidden /> Contato
              </a>
            )}
            {chatId && (
              <a href={urlChatSellflux(chatId)} target="_blank" rel="noopener noreferrer" className={LINK_SELLFLUX} title="Abre a conversa deste lead na Sellflux">
                <MessageSquareTextIcon className="size-3.5" aria-hidden /> Chat
              </a>
            )}
            <a
              href={urlAgendaSellflux({ data: reserva.data, respUserId: grade.unidade.sellfluxUserId, busca: reserva.nome })}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_SELLFLUX}
              title={`Abre a agenda da Sellflux em ${reserva.data.split("-").reverse().join("/")}, filtrada por “${reserva.nome}”`}
            >
              <CalendarDaysIcon className="size-3.5" aria-hidden /> Agenda
            </a>
            {!vinculos && !erroVinculos && !chatId && <span className="text-xs text-muted-foreground">Buscando contato…</span>}
            {erroVinculos && !chatId && <span className="text-xs text-muted-foreground">Não foi possível buscar o contato na Sellflux.</span>}
            {vinculos && !leadId && !chatId && <span className="text-xs text-muted-foreground">Sem contato vinculado — agendamento criado sem lead.</span>}
          </div>

          {reserva.cancelado && linhasDescricao.length > 0 && (
            <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
              <p className="mb-1 text-xs text-muted-foreground">Descrição na Sellflux</p>
              <ul className="grid gap-0.5">{linhasDescricao.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </div>
          )}

          {!reserva.cancelado && (
            <form onSubmit={enviar} className="grid gap-3 border-t pt-3">
              <div className="grid gap-2">
                <Label htmlFor="e-nome">Nome</Label>
                <Input id="e-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="e-tel">Telefone</Label>
                  <TelefoneInput id="e-tel" value={telefone} onChange={setTelefone} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="e-pessoas">Pessoas</Label>
                  <PessoasStepper id="e-pessoas" value={pessoas} onChange={setPessoas} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Bateria</Label>
                <HorarioPicker slots={slotsParaPicker} value={horario} onChange={(h) => { setHorario(h); setConfirmarPassado(false); }} pessoas={n} atual={reserva.horario} passados={passados} />
                {!cabeDestino && destino && (
                  <p className="text-sm text-lotado">{destino.horario} tem só {destino.vagas} vaga{destino.vagas === 1 ? "" : "s"} — não cabem {n}.</p>
                )}
                {moverParaPassado && (
                  <div className="rounded-md border border-enchendo/40 bg-enchendo-soft p-2.5 text-sm">
                    <p className="font-medium">A bateria {horario} já passou.</p>
                    {confirmarPassado && (
                      <div className="mt-2 flex gap-2">
                        <Button type="button" size="sm" className="bg-ink text-ink-foreground hover:bg-ink/85" onClick={() => void salvar()} disabled={salvando}>{salvando ? "Salvando…" : "Sim, mover mesmo assim"}</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmarPassado(false)}>Voltar</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e-desc">Descrição <span className="font-normal text-muted-foreground">(como está na Sellflux)</span></Label>
                <Textarea id="e-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={4000} rows={6} className="font-sans" />
                <p className="text-xs text-muted-foreground">Texto livre. Ao mudar nome, pessoas, telefone ou bateria acima, o app atualiza só a linha correspondente aqui.</p>
              </div>
              {erro && <p className="text-sm text-lotado">{erro}</p>}
              <Button type="submit" className="bg-ink text-ink-foreground hover:bg-ink/85" disabled={!mudou || !cabeDestino || telefoneInvalido || salvando || confirmarPassado}>{salvando ? "Salvando…" : "Salvar alterações"}</Button>
            </form>
          )}
        </div>

        {!reserva.cancelado && (
          <SheetFooter className="border-t">
            {confirmar ? (
              <div className="flex w-full flex-col gap-2">
                <p className="text-sm">Cancelar a reserva de <strong>{reserva.nome}</strong>? Libera {reserva.pessoas} kart{reserva.pessoas === 1 ? "" : "s"} às {reserva.horario}. Na Sellflux, o título recebe ❌.</p>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={cancelar} disabled={cancelando}>{cancelando ? "Cancelando…" : "Sim, cancelar reserva"}</Button>
                  <Button variant="ghost" onClick={() => setConfirmar(false)}>Voltar</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="text-lotado" onClick={() => setConfirmar(true)}>Cancelar reserva</Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
