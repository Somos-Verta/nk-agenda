"use client";

import { CircleHelpIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api-client";
import type { Grade } from "@/lib/agenda";
import { periodoDe, type Reserva, type Slot, type Unidade } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { DateNav, formatarDataLonga } from "./DateNav";
import { NovaReservaDialog } from "./NovaReservaDialog";
import { RegrasDialog } from "./RegrasDialog";
import { ReservaSheet } from "./ReservaSheet";
import { ReservaLinha, SlotRow, idDaBateria } from "./SlotRow";
import { bateriaEmPista, bateriaPassou, useAgora } from "./useAgora";

type Item = { tipo: "periodo"; label: string } | { tipo: "slot"; slot: Slot } | { tipo: "agora"; horario: string };

function N({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-foreground tabular-nums">{children}</strong>;
}

export function AgendaClient({ unidade, hoje, dataInicial }: { unidade: Unidade; hoje: string; dataInicial?: string }) {
  const [data, setData] = useState(dataInicial ?? hoje);
  const [regras, setRegras] = useState(false);
  // resultado carrega a chave (unidade|data) que produziu; "carregando" é derivado, sem setState síncrono em effect
  const chave = `${unidade.slug}|${data}`;
  const [resultado, setResultado] = useState<{ chave: string; grade: Grade | null; erro: Record<string, unknown> | null } | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const seq = useRef(0);
  const rolouPara = useRef<string | null>(null);
  const [novaHorario, setNovaHorario] = useState<string | null | undefined>(undefined); // undefined = fechado
  const [aberta, setAberta] = useState<Reserva | null>(null);
  const agora = useAgora();

  const grade = resultado?.chave === chave ? resultado.grade : null;
  const erro = resultado?.chave === chave ? resultado.erro : null;
  const carregando = (resultado?.chave !== chave) || atualizando;

  const hojeReal = agora?.data ?? hoje;
  const ehHoje = data === hojeReal;
  const passou = (s: Slot) => bateriaPassou(data, s.fim, agora);
  const emPista = (s: Slot) => bateriaEmPista(data, s.horario, s.fim, agora);

  const recarregar = useCallback(async () => {
    const meu = ++seq.current;
    try {
      const g = await api<Grade>(`/api/agenda?unidade=${unidade.slug}&data=${data}`);
      if (meu === seq.current) setResultado({ chave, grade: g, erro: null });
    } catch (e) {
      if (meu === seq.current) setResultado({ chave, grade: null, erro: e instanceof ApiError ? e.payload : { mensagem: String(e) } });
    }
  }, [unidade.slug, data, chave]);

  // recarrega mantendo a grade atual na tela (botão atualizar, pós-criação/edição)
  const atualizar = useCallback(async () => {
    setAtualizando(true);
    try { await recarregar(); } finally { setAtualizando(false); }
  }, [recarregar]);

  // o setState só acontece depois do await (resposta da API), não de forma síncrona no effect
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void recarregar(); }, [recarregar]);

  // a data fica na URL: recarregar ou favoritar a página volta no mesmo dia, e os links das unidades no menu
  // (useSearchParams) passam a carregar o mesmo ?d=. O estado precisa ser null: com o estado do próprio Next,
  // o router ignora a chamada e useSearchParams não atualiza.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (data === hoje) url.searchParams.delete("d"); else url.searchParams.set("d", data);
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  }, [data, hoje]);

  // hoje: ao abrir, leva a tela até a linha "agora" (as baterias passadas ficam acima, esmaecidas)
  useEffect(() => {
    if (!grade || !ehHoje || !agora || rolouPara.current === chave) return;
    const el = document.getElementById("agora");
    if (el) { el.scrollIntoView({ block: "center" }); rolouPara.current = chave; }
  }, [grade, ehHoje, agora, chave]);

  // ---- derivados da grade ----
  const slots = grade?.slots ?? [];
  const futuros = slots.filter((s) => !passou(s));
  const kartsLivres = futuros.reduce((a, s) => a + s.vagas, 0);
  const kartsTotal = futuros.length * unidade.capacidade;
  const ativas = slots.flatMap((s) => s.reservas).filter((r) => !r.cancelado);
  const pessoasReservadas = ativas.reduce((a, r) => a + r.pessoas, 0);
  const excedidas = slots.filter((s) => s.ocupacao > s.capacidade);

  const itens: Item[] = [];
  let periodo: string | null = null;
  let marcouAgora = false;
  for (const s of slots) {
    const p = periodoDe(s.horario);
    if (p !== periodo) { itens.push({ tipo: "periodo", label: p }); periodo = p; }
    if (ehHoje && agora && !marcouAgora && !passou(s)) { itens.push({ tipo: "agora", horario: agora.horario }); marcouAgora = true; }
    itens.push({ tipo: "slot", slot: s });
  }

  function irParaBateria(horario: string) {
    document.getElementById(idDaBateria(horario))?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function renderItem(item: Item, i: number) {
    switch (item.tipo) {
      case "periodo":
        return <li key={`p-${item.label}-${i}`} className="border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground sm:px-4">{item.label}</li>;
      case "agora":
        // linha vermelha com o ponto na margem, como a "hora atual" do Google Agenda
        return (
          <li key="agora" id="agora" className="relative flex items-center py-0.5" aria-label={`Agora ${item.horario}`}>
            <span className="ml-1.5 size-3 shrink-0 rounded-full bg-agora" />
            <span className="h-0.5 flex-1 bg-agora" />
            <span className="absolute top-1/2 left-6 -translate-y-1/2 rounded bg-card px-1 text-[10px] font-semibold text-agora tabular-nums">agora {item.horario}</span>
          </li>
        );
      case "slot":
        return (
          <SlotRow
            key={item.slot.horario}
            slot={item.slot}
            passado={passou(item.slot)}
            emPista={emPista(item.slot)}
            onNova={(h) => setNovaHorario(h)}
            onAbrir={setAberta}
          />
        );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4">
      {/* barra de controles */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <DateNav data={data} hoje={hojeReal} onChange={setData} />
        <Button variant="outline" size="icon" onClick={() => void atualizar()} disabled={carregando} aria-label="Atualizar agenda" title="Buscar de novo na Sellflux">
          <RefreshCwIcon className={cn(atualizando && "animate-spin")} />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setRegras(true)} aria-label="Regras: como as vagas são calculadas" title="Como as vagas são calculadas">
            <CircleHelpIcon data-icon="inline-start" /><span className="hidden sm:inline">Regras</span>
          </Button>
          <Button onClick={() => setNovaHorario(null)} disabled={!grade} className="bg-ink text-ink-foreground hover:bg-ink/85">
            <PlusIcon data-icon="inline-start" /> Nova reserva
          </Button>
        </div>
      </div>

      {/* título do dia + resumo */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h1 className="text-xl font-semibold tracking-tight first-letter:uppercase">{formatarDataLonga(data)}{ehHoje && <span className="ml-2 text-sm font-normal text-muted-foreground">hoje</span>}</h1>
          <p className="text-sm text-muted-foreground">{unidade.nome} · baterias de {unidade.duracaoMin} min · {unidade.capacidade} karts por bateria</p>
        </div>
        {grade && slots.length > 0 && (
          <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
            {futuros.length > 0 && <span><N>{kartsLivres}</N> de {kartsTotal} karts livres{ehHoje && futuros.length < slots.length ? " no resto do dia" : ""}</span>}
            <span><N>{ativas.length}</N> reserva{ativas.length === 1 ? "" : "s"} · <N>{pessoasReservadas}</N> pessoa{pessoasReservadas === 1 ? "" : "s"}</span>
          </p>
        )}
      </div>

      {erro && (
        <div className="rounded-lg border border-lotado/40 bg-lotado-soft p-4 text-sm">
          <p className="font-medium">Não foi possível carregar a agenda.</p>
          <p className="text-muted-foreground">{String(erro.mensagem ?? erro.erro ?? "")}</p>
          {erro.erro === "unidade_nao_configurada" && <Link href="/configuracao" className="underline underline-offset-3">Ir para Configuração</Link>}
        </div>
      )}

      {/* avisos: o que precisa de atenção antes de olhar a grade */}
      {grade && excedidas.length > 0 && (
        <div className="rounded-xl border border-lotado/40 bg-lotado-soft p-3 text-sm">
          <p className="font-medium">Mais pessoas que karts ({excedidas.length} bateria{excedidas.length === 1 ? "" : "s"})</p>
          <p className="text-muted-foreground">Reservas somam mais que a capacidade — confira as quantidades ou mova alguém.</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {excedidas.map((s) => (
              <li key={s.horario}>
                <button type="button" onClick={() => irParaBateria(s.horario)} className="inline-flex items-center gap-1.5 rounded-md border border-lotado/40 bg-card px-2 py-1 text-sm hover:bg-muted">
                  <span className="font-semibold tabular-nums">{s.horario}</span>
                  <span className="tabular-nums">{s.ocupacao} pessoas em {s.capacidade} karts</span>
                  <span className="font-semibold text-lotado tabular-nums">+{s.ocupacao - s.capacidade}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {grade && grade.foraDaGrade.length > 0 && (
        <div className="rounded-xl border border-enchendo/40 bg-enchendo-soft p-3 text-sm">
          <p className="font-medium">Fora da grade de horários ({grade.foraDaGrade.length})</p>
          <p className="text-muted-foreground">Agendamentos em horários que a unidade não abre. Não ocupam bateria — abra para mover ou cancelar.</p>
          <ul className="mt-2 flex flex-col">
            {grade.foraDaGrade.map((r) => (
              <li key={String(r.id)}><ReservaLinha r={r} horario onClick={() => setAberta(r)} /></li>
            ))}
          </ul>
        </div>
      )}

      {carregando && !grade && (
        <div className="grid gap-px overflow-hidden rounded-xl border bg-card">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-none" />)}
        </div>
      )}

      {grade && slots.length === 0 && !erro && (
        <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          {unidade.nome} não abre neste dia. Os horários de funcionamento ficam em <Link href="/configuracao" className="underline underline-offset-3">Configuração</Link>.
        </p>
      )}

      {grade && slots.length > 0 && (
        <ol className={cn("overflow-hidden rounded-xl border bg-card transition-opacity", carregando && "opacity-60")}>{itens.map(renderItem)}</ol>
      )}

      {grade && novaHorario !== undefined && (
        <NovaReservaDialog
          grade={grade}
          horarioInicial={novaHorario}
          agora={agora}
          onClose={() => setNovaHorario(undefined)}
          onCriada={(r) => { toast.success(`Reserva de ${r.nome} (${r.pessoas}p) às ${r.horario} criada.`); setNovaHorario(undefined); void atualizar(); }}
          onConflito={() => void atualizar()}
        />
      )}

      {grade && aberta && (
        <ReservaSheet
          grade={grade}
          reserva={aberta}
          agora={agora}
          onClose={() => setAberta(null)}
          onAlterada={() => { setAberta(null); void atualizar(); }}
        />
      )}

      {regras && <RegrasDialog unidade={unidade} onClose={() => setRegras(false)} />}
    </main>
  );
}
