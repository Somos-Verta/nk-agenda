/**
 * Único ponto de contato com o banco. Hoje: Supabase (projeto compartilhado N8N - RevLab, tabelas nk_unidades e nk_reserva_status).
 * Trocar de banco = reescrever só este arquivo.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { invalidar, memo } from "./cache";
import type { Horarios, Unidade } from "./slots";
import { statusSchema, type StatusLocal } from "./status";

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const intervaloSchema = z
  .object({ inicio: z.string().regex(HORA), fim: z.string().regex(HORA) })
  .refine((i) => i.inicio < i.fim, { message: "início deve ser antes do fim" });
const listaIntervalos = z.array(intervaloSchema).default([]);

export const horariosSchema = z.object({
  "0": listaIntervalos, "1": listaIntervalos, "2": listaIntervalos, "3": listaIntervalos,
  "4": listaIntervalos, "5": listaIntervalos, "6": listaIntervalos,
});

export const unidadePatchSchema = z.object({
  nome: z.string().trim().min(1).max(60).optional(),
  sellfluxUserId: z.number().int().positive().nullable().optional(),
  capacidade: z.number().int().min(1).max(200).optional(),
  duracaoMin: z.number().int().min(5).max(240).optional(),
  // centavos são aceitos; acima de 2 casas o Postgres arredonda (numeric(10,2))
  precoPessoa: z.number().min(0).max(99_999_999).nullable().optional(),
  horarios: horariosSchema.optional(),
});
export type UnidadePatch = z.infer<typeof unidadePatchSchema>;

type Row = {
  slug: string;
  nome: string;
  sellflux_user_id: number | null;
  capacidade: number;
  duracao_min: number;
  preco_pessoa: number | string | null; // numeric chega como string pelo PostgREST
  horarios: unknown;
  updated_at: string;
};

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

function rowParaUnidade(r: Row): Unidade {
  const parsed = horariosSchema.safeParse(r.horarios);
  return {
    slug: r.slug,
    nome: r.nome,
    sellfluxUserId: r.sellflux_user_id,
    capacidade: r.capacidade,
    duracaoMin: r.duracao_min,
    precoPessoa: r.preco_pessoa === null || r.preco_pessoa === undefined ? null : Number(r.preco_pessoa),
    horarios: (parsed.success ? parsed.data : horariosSchema.parse({})) as Horarios,
  };
}

/**
 * Capacidade e horários mudam só na tela Configuração, mas eram lidos a cada carga da agenda
 * (190-480 ms por requisição, medido). Ficam em cache por `TTL_MS`; gravar invalida na hora.
 * Outra instância do servidor só vê a mudança quando o TTL dela expira.
 */
const CHAVE = "unidades";
const TTL_MS = 60_000;

export async function listarUnidades(): Promise<Unidade[]> {
  return memo(CHAVE, TTL_MS, async () => {
    const { data, error } = await db().from("nk_unidades").select("*").order("nome");
    if (error) throw new Error(`Supabase: ${error.message}`);
    return (data as Row[]).map(rowParaUnidade);
  });
}

/** A tabela tem uma linha por unidade: a lista inteira custa o mesmo que uma linha e já vem cacheada. */
export async function buscarUnidade(slug: string): Promise<Unidade | null> {
  return (await listarUnidades()).find((u) => u.slug === slug) ?? null;
}

export async function salvarUnidade(slug: string, patch: UnidadePatch): Promise<Unidade> {
  const row: Partial<Row> = {};
  if (patch.nome !== undefined) row.nome = patch.nome;
  if (patch.sellfluxUserId !== undefined) row.sellflux_user_id = patch.sellfluxUserId;
  if (patch.capacidade !== undefined) row.capacidade = patch.capacidade;
  if (patch.duracaoMin !== undefined) row.duracao_min = patch.duracaoMin;
  if (patch.precoPessoa !== undefined) row.preco_pessoa = patch.precoPessoa;
  if (patch.horarios !== undefined) row.horarios = patch.horarios;
  const { data, error } = await db().from("nk_unidades").update(row).eq("slug", slug).select("*").single();
  if (error) throw new Error(`Supabase: ${error.message}`);
  invalidar(CHAVE);
  return rowParaUnidade(data as Row);
}

// ---------- Status das reservas (registro local; ver lib/status.ts) ----------

type StatusRow = { schedule_id: number | string; data: string; status: string; base_status: string };

function rowParaStatus(r: StatusRow): StatusLocal | null {
  const status = statusSchema.safeParse(r.status);
  const base = statusSchema.safeParse(r.base_status);
  return status.success && base.success ? { id: r.schedule_id, data: r.data, status: status.data, baseStatus: base.data } : null;
}

/**
 * Registros do dia — uma consulta por dia (e não por reserva), para rodar em paralelo com a leitura da Sellflux.
 * Sem cache: a tela precisa ver o status que outra atendente acabou de gravar.
 */
export async function listarStatusDoDia(data: string): Promise<StatusLocal[]> {
  const { data: rows, error } = await db().from("nk_reserva_status").select("schedule_id, data, status, base_status").eq("data", data);
  if (error) throw new Error(`Supabase: ${error.message}`);
  return (rows as StatusRow[]).map(rowParaStatus).filter((s): s is StatusLocal => s !== null);
}

export async function buscarStatusLocal(id: number | string): Promise<StatusLocal | null> {
  const { data: row, error } = await db().from("nk_reserva_status").select("schedule_id, data, status, base_status").eq("schedule_id", id).maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  return row ? rowParaStatus(row as StatusRow) : null;
}

export async function salvarStatusLocal(s: StatusLocal): Promise<void> {
  const { error } = await db().from("nk_reserva_status").upsert({ schedule_id: s.id, data: s.data, status: s.status, base_status: s.baseStatus }, { onConflict: "schedule_id" });
  if (error) throw new Error(`Supabase: ${error.message}`);
}
