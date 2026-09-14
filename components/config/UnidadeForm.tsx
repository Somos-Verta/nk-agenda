"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api-client";
import { DIAS_SEMANA_LABEL, type DiaSemana, type Horarios, type Unidade } from "@/lib/slots";
import type { UsuarioOpcao } from "./ConfigClient";

const DIAS: DiaSemana[] = ["1", "2", "3", "4", "5", "6", "0"];
const NENHUM = "__nenhum__";

export function UnidadeForm({ unidade, usuarios, onSalva }: { unidade: Unidade; usuarios: UsuarioOpcao[] | null; onSalva: (u: Unidade) => void }) {
  const [nome, setNome] = useState(unidade.nome);
  const [userId, setUserId] = useState<string>(unidade.sellfluxUserId ? String(unidade.sellfluxUserId) : NENHUM);
  const [capacidade, setCapacidade] = useState(String(unidade.capacidade));
  const [duracao, setDuracao] = useState(String(unidade.duracaoMin));
  const [horarios, setHorarios] = useState<Horarios>(unidade.horarios);
  const [salvando, setSalvando] = useState(false);

  // usuário atual pode não estar na lista (token sem acesso, id antigo): mantém a opção visível
  const opcoes = usuarios ?? [];
  const atualNaLista = userId === NENHUM || opcoes.some((u) => String(u.id) === userId);

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {unidade.nome}
          {!unidade.sellfluxUserId && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800 dark:bg-amber-950 dark:text-amber-300">sem usuário Sellflux</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto]">
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
              <Select value={userId} onValueChange={(v) => setUserId(String(v ?? NENHUM))}>
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
              <Label htmlFor={`${unidade.slug}-cap`}>Karts / bateria</Label>
              <Input id={`${unidade.slug}-cap`} type="number" min={1} className="w-24" value={capacidade} onChange={(e) => setCapacidade(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${unidade.slug}-dur`}>Duração (min)</Label>
              <Input id={`${unidade.slug}-dur`} type="number" min={5} step={5} className="w-24" value={duracao} onChange={(e) => setDuracao(e.target.value)} required />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Horários de funcionamento</Label>
            <div className="grid gap-1.5">
              {DIAS.map((dia) => {
                const intervalos = horarios[dia] ?? [];
                const aberto = intervalos.length > 0;
                return (
                  <div key={dia} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-1.5">
                    <Switch checked={aberto} onCheckedChange={(on) => setDia(dia, on ? [{ inicio: "10:00", fim: "22:00" }] : [])} aria-label={`${DIAS_SEMANA_LABEL[dia]} aberto`} />
                    <span className="w-20 text-sm">{DIAS_SEMANA_LABEL[dia]}</span>
                    {!aberto && <span className="text-sm text-muted-foreground">Fechado</span>}
                    {intervalos.map((iv, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <Input type="time" step={300} className="w-28" value={iv.inicio} onChange={(e) => setDia(dia, intervalos.map((x, j) => (j === i ? { ...x, inicio: e.target.value } : x)))} required />
                        <span className="text-sm text-muted-foreground">às</span>
                        <Input type="time" step={300} className="w-28" value={iv.fim} onChange={(e) => setDia(dia, intervalos.map((x, j) => (j === i ? { ...x, fim: e.target.value } : x)))} required />
                        {intervalos.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" aria-label="Remover intervalo" onClick={() => setDia(dia, intervalos.filter((_, j) => j !== i))}><Trash2Icon /></Button>
                        )}
                      </span>
                    ))}
                    {aberto && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDia(dia, [...intervalos, { inicio: intervalos[intervalos.length - 1].fim, fim: "23:00" }])}><PlusIcon /> intervalo</Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
