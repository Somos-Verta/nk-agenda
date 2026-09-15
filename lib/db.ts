/**
 * Único ponto de contato com o banco. Hoje: Supabase (projeto compartilhado N8N - RevLab, tabela nk_unidades).
 * Trocar de banco = reescrever só este arquivo.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Horarios, Unidade } from "./slots";

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

export async function listarUnidades(): Promise<Unidade[]> {
  const { data, error } = await db().from("nk_unidades").select("*").order("nome");
  if (error) throw new Error(`Supabase: ${error.message}`);
  return (data as Row[]).map(rowParaUnidade);
}

export async function buscarUnidade(slug: string): Promise<Unidade | null> {
  const { data, error } = await db().from("nk_unidades").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data ? rowParaUnidade(data as Row) : null;
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
  return rowParaUnidade(data as Row);
}
