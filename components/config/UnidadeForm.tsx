"use client";

import { CalendarDaysIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api-client";
import { DIAS_SEMANA_LABEL, horariosDeIntervalos, type DiaSemana, type Horarios, type Unidade } from "@/lib/slots";
import { cn } from "@/lib/utils";
import type { UsuarioOpcao } from "./ConfigClient";

const DIAS: DiaSemana[] = ["1", "2", "3", "4", "5", "6", "0"];
const NENHUM = "__nenhum__";
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "89,90" / "89.90" / "" → número em reais ou null. NaN quando o texto não é um valor. */
function parsePreco(texto: string): number | null {
  const t = texto.trim().replace(/\s|R\$/g, "");
  if (t === "") return null;
  return Number(t.replace(",", "."));
}

/** "16 baterias · 14:00 → 21:30" — o efeito concreto da duração + horários, calculado ao vivo. */
function resumoBaterias(hs: string[]): string {
  if (hs.length === 0) return "nenhuma bateria — confira duração e horários";
  return `${hs.length} bateria${hs.length === 1 ? "" : "s"} · ${hs[0]} → ${hs[hs.length - 1]}`;
}

export function UnidadeForm({ unidade, usuarios, onSalva }: { unidade: Unidade; usuarios: UsuarioOpcao[] | null; onSalva: (u: Unidade) => void }) {
  const [nome, setNome] = useState(unidade.nome);
  const [userId, setUserId] = useState<string>(unidade.sellfluxUserId ? String(unidade.sellfluxUserId) : NENHUM);
  const [capacidade, setCapacidade] = useState(String(unidade.capacidade));
  const [duracao, setDuracao] = useState(String(unidade.duracaoMin));
  const [preco, setPreco] = useState(unidade.precoPessoa === null ? "" : unidade.precoPessoa.toFixed(2).replace(".", ","));
  const [horarios, setHorarios] = useState<Horarios>(unidade.horarios);
  const [salvando, setSalvando] = useState(false);

  // usuário atual pode não estar na lista (token sem acesso, id antigo): mantém a opção visível
  const opcoes = usuarios ?? [];
  const atualNaLista = userId === NENHUM || opcoes.some((u) => String(u.id) === userId);
  // rótulos para o Select mostrar o nome do usuário (e não o id) com o popup fechado
  const rotulos: Record<string, string> = { [NENHUM]: "— nenhum —", ...(atualNaLista ? {} : { [userId]: `id ${userId} (fora da lista)` }) };
  for (const u of opcoes) rotulos[String(u.id)] = u.nome;
  const duracaoNum = Number(duracao) || 0;
  const precoNum = parsePreco(preco);
  const precoInvalido = precoNum !== null && (!Number.isFinite(precoNum) || precoNum < 0);
  const diasAbertos = DIAS.filter((d) => (horarios[d] ?? []).length > 0).length;
  const mudou =
    nome !== unidade.nome ||
    (userId === NENHUM ? null : Number(userId)) !== unidade.sellfluxUserId ||
    Number(capacidade) !== unidade.capacidade ||
    duracaoNum !== unidade.duracaoMin ||
    precoNum !== unidade.precoPessoa ||
    JSON.stringify(horarios) !== JSON.stringify(unidade.horarios);

  function setDia(dia: DiaSemana, intervalos: Horarios[DiaSemana]) {
    setHorarios((h) => ({ ...h, [dia]: intervalos }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const nova = await api<Unidade>("/api/config", {
        method: "PUT",
        json: {
          slug: unidade.slug,
          patch: {
            nome,
            sellfluxUserId: userId === NENHUM ? null : Number(userId),
            capacidade: Number(capacidade),
            duracaoMin: Number(duracao),
            precoPessoa: precoNum === null ? null : Math.round(precoNum * 100) / 100,
            horarios,
          },
        },
      });
      onSalva(nova);
      toast.success(`${nova.nome} salva.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card id={unidade.slug}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            {unidade.nome}
            {!unidade.sellfluxUserId && <span className="rounded-full bg-enchendo-soft px-2 py-0.5 text-xs font-medium text-enchendo">sem usuário Sellflux</span>}
          </CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {unidade.capacidade} karts por bateria · baterias de {unidade.duracaoMin} min · {unidade.precoPessoa === null ? "sem preço por pessoa" : `${BRL.format(unidade.precoPessoa)} por pessoa`} · {diasAbertos === 0 ? "sem horários de funcionamento" : diasAbertos === 7 ? "aberta todos os dias" : `aberta ${diasAbertos} dia${diasAbertos === 1 ? "" : "s"} por semana`}
          </p>
        </div>
        <Link href={`/agenda/${unidade.slug}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm hover:bg-muted">
          <CalendarDaysIcon className="size-4" aria-hidden /> Ver agenda
        </Link>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto_auto]">
            <div className="grid gap-1.5">
              <Label htmlFor={`${unidade.slug}-nome`}>Nome</Label>
              <Input id={`${unidade.slug}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label>Usuário Sellflux (agenda da unidade)</Label>
              {usuarios === null || usuarios.length === 0 ? (
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="id do usuário (ex.: 56173)"
                  value={userId === NENHUM ? "" : userId}
                  onChange={(e) => setUserId(e.target.value ? e.target.value : NENHUM)}
                />
              ) : (
              <Select value={userId} onValueChange={(v) => setUserId(String(v ?? NENHUM))} items={rotulos}>
                <SelectTrigger className="w-full"><SelectValue placeholder={usuarios ? "Escolha o usuário" : "Carregando…"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>— nenhum —</SelectItem>
                  {!atualNaLista && <SelectItem value={userId}>id {userId} (fora da lista)</SelectItem>}
                  {opcoes.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.nome}{u.email ? ` · ${u.email}` : ""} (#{u.id})</SelectItem>)}
                </SelectContent>
              </Select>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${unidade.slug}-cap`}>Karts por bateria</Label>
              <Input id={`${unidade.slug}-cap`} type="number" min={1} max={200} className="w-28 tabular-nums" value={capacidade} onChange={(e) => setCapacidade(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${unidade.slug}-dur`}>Duração (min)</Label>
              <Input id={`${unidade.slug}-dur`} type="number" min={5} max={240} step={5} className="w-28 tabular-nums" value={duracao} onChange={(e) => setDuracao(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${unidade.slug}-preco`}>Preço por pessoa</Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">R$</span>
                <Input
                  id={`${unidade.slug}-preco`}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={cn("w-32 pl-8 tabular-nums", precoInvalido && "border-lotado")}
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  aria-invalid={precoInvalido || undefined}
                  aria-describedby={`${unidade.slug}-preco-dica`}
                />
              </div>
              <p id={`${unidade.slug}-preco-dica`} className={cn("text-xs", precoInvalido ? "text-lotado" : "text-muted-foreground")}>
                {precoInvalido ? "Use um valor como 89,90." : "Por bateria. Base da previsão de faturamento."}
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <div>
              <Label>Horários de funcionamento</Label>
              <p className="text-xs text-muted-foreground">A agenda gera uma bateria a cada {duracaoNum || "—"} min dentro de cada intervalo. A última precisa terminar antes do fechamento.</p>
            </div>
            <div className="overflow-hidden rounded-lg border">
              {DIAS.map((dia) => {
                const intervalos = horarios[dia] ?? [];
                const aberto = intervalos.length > 0;
                const baterias = horariosDeIntervalos(intervalos, duracaoNum);
                return (
                  <div key={dia} className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b px-3 py-1.5 last:border-b-0", !aberto && "bg-muted/30")}>
                    <Switch checked={aberto} onCheckedChange={(on) => setDia(dia, on ? [{ inicio: "10:00", fim: "22:00" }] : [])} aria-label={`${DIAS_SEMANA_LABEL[dia]} aberto`} />
                    <span className={cn("w-20 text-sm font-medium", !aberto && "text-muted-foreground")}>{DIAS_SEMANA_LABEL[dia]}</span>
                    {!aberto && <span className="text-sm text-muted-foreground">Fechado</span>}
                    {intervalos.map((iv, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <Input type="time" step={300} className="w-27 tabular-nums" value={iv.inicio} onChange={(e) => setDia(dia, intervalos.map((x, j) => (j === i ? { ...x, inicio: e.target.value } : x)))} required aria-label="Abre às" />
                        <span className="text-sm text-muted-foreground">às</span>
                        <Input type="time" step={300} className="w-27 tabular-nums" value={iv.fim} onChange={(e) => setDia(dia, intervalos.map((x, j) => (j === i ? { ...x, fim: e.target.value } : x)))} required aria-label="Fecha às" />
                        {intervalos.length > 1 && (
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover intervalo" onClick={() => setDia(dia, intervalos.filter((_, j) => j !== i))}><Trash2Icon /></Button>
                        )}
                      </span>
                    ))}
                    {aberto && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDia(dia, [...intervalos, { inicio: intervalos[intervalos.length - 1].fim, fim: "23:00" }])}><PlusIcon data-icon="inline-start" /> intervalo</Button>
                    )}
                    {aberto && (
                      <span className={cn("ml-auto text-xs tabular-nums", baterias.length === 0 ? "font-medium text-lotado" : "text-muted-foreground")}>{resumoBaterias(baterias)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {mudou && !salvando && <span className="text-sm text-muted-foreground">Alterações não salvas</span>}
            <Button type="submit" className="bg-ink text-ink-foreground hover:bg-ink/85" disabled={salvando || !mudou || precoInvalido}>{salvando ? "Salvando…" : "Salvar"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
