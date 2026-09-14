"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api-client";
import type { Grade } from "@/lib/agenda";
import type { Reserva, Unidade } from "@/lib/slots";
import { DateNav, formatarDataLonga } from "./DateNav";
import { NovaReservaDialog } from "./NovaReservaDialog";
import { ReservaSheet } from "./ReservaSheet";
import { SlotCard } from "./SlotCard";

export function AgendaClient({ unidades, hoje }: { unidades: Unidade[]; hoje: string }) {
  const [slug, setSlug] = useState(unidades[0]?.slug ?? "");
  const [data, setData] = useState(hoje);
  const [filtro, setFiltro] = useState("");
  // resultado carrega a chave (unidade|data) que produziu; "carregando" é derivado, sem setState síncrono em effect
  const chave = `${slug}|${data}`;
  const [resultado, setResultado] = useState<{ chave: string; grade: Grade | null; erro: Record<string, unknown> | null } | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const seq = useRef(0);
  const [novaHorario, setNovaHorario] = useState<string | null | undefined>(undefined); // undefined = fechado
  const [aberta, setAberta] = useState<Reserva | null>(null);

  const unidade = unidades.find((u) => u.slug === slug);
  const filtroPessoas = filtro && Number(filtro) > 0 ? Number(filtro) : null;
  const grade = resultado?.chave === chave ? resultado.grade : null;
  const erro = resultado?.chave === chave ? resultado.erro : null;
  const carregando = (resultado?.chave !== chave && !!slug) || atualizando;

  const recarregar = useCallback(async () => {
    if (!slug) return;
    const meu = ++seq.current;
    try {
      const g = await api<Grade>(`/api/agenda?unidade=${slug}&data=${data}`);
      if (meu === seq.current) setResultado({ chave, grade: g, erro: null });
    } catch (e) {
      if (meu === seq.current) setResultado({ chave, grade: null, erro: e instanceof ApiError ? e.payload : { mensagem: String(e) } });
    }
  }, [slug, data, chave]);

  // recarrega mantendo a grade atual na tela (pós-criação/edição)
  const atualizar = useCallback(async () => {
    setAtualizando(true);
    try { await recarregar(); } finally { setAtualizando(false); }
  }, [recarregar]);

  // o setState só acontece depois do await (resposta da API), não de forma síncrona no effect
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void recarregar(); }, [recarregar]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={slug} onValueChange={(v) => setSlug(String(v))}>
          <TabsList>
            {unidades.map((u) => <TabsTrigger key={u.slug} value={u.slug}>{u.nome}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <DateNav data={data} hoje={hoje} onChange={setData} />
        <div className="flex items-center gap-2">
          <label htmlFor="filtro" className="text-sm text-muted-foreground">Quantas pessoas?</label>
          <Input id="filtro" type="number" min={1} inputMode="numeric" value={filtro} onChange={(e) => setFiltro(e.target.value)} className="w-20" placeholder="—" />
        </div>
        <Button className="ml-auto" onClick={() => setNovaHorario(null)} disabled={!grade}>+ Nova reserva</Button>
      </div>

      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold capitalize">{unidade?.nome} · {formatarDataLonga(data)}</h1>
        {grade && <span className="text-sm text-muted-foreground">{grade.slots.length} baterias · {unidade?.capacidade} karts cada</span>}
      </div>

      {erro && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">Não foi possível carregar a agenda.</p>
          <p className="text-muted-foreground">{String(erro.mensagem ?? erro.erro ?? "")}</p>
          {erro.erro === "unidade_nao_configurada" && <Link href="/configuracao" className="underline">Ir para Configuração</Link>}
        </div>
      )}

      {carregando && !grade && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      )}

      {grade && grade.slots.length === 0 && !erro && (
        <p className="rounded-lg border p-6 text-center text-muted-foreground">Unidade fechada neste dia. Ajuste os horários em <Link href="/configuracao" className="underline">Configuração</Link>.</p>
      )}

      {grade && grade.slots.length > 0 && (
        <div className={carregando ? "opacity-60" : ""}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {grade.slots.map((s) => (
              <SlotCard key={s.horario} slot={s} filtroPessoas={filtroPessoas} onNova={(h) => setNovaHorario(h)} onAbrir={setAberta} />
            ))}
          </div>
          {grade.foraDaGrade.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
              <p className="font-medium">Fora da grade de horários ({grade.foraDaGrade.length})</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {grade.foraDaGrade.map((r) => (
                  <li key={String(r.id)}>
                    <button type="button" onClick={() => setAberta(r)} className="rounded bg-background px-2 py-0.5 hover:underline">{r.horario} · {r.nome} {r.pessoas}p</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {grade && unidade && novaHorario !== undefined && (
        <NovaReservaDialog
          grade={grade}
          horarioInicial={novaHorario}
          pessoasIniciais={filtroPessoas}
          onClose={() => setNovaHorario(undefined)}
          onCriada={(r) => { toast.success(`Reserva de ${r.nome} (${r.pessoas}p) às ${r.horario} criada.`); setNovaHorario(undefined); void atualizar(); }}
        />
      )}

      {grade && unidade && aberta && (
        <ReservaSheet
          grade={grade}
          reserva={aberta}
          onClose={() => setAberta(null)}
          onAlterada={() => { setAberta(null); void atualizar(); }}
        />
      )}
    </main>
  );
}
