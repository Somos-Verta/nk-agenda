import { NextResponse } from "next/server";
import { carregarGrade, criarReserva, novaReservaSchema, unidadeOuErro } from "@/lib/agenda";
import { AppError, handler, json } from "@/lib/http";
import { invalidarSchedules } from "@/lib/sellflux";
import { hojeLocal } from "@/lib/tz";

/**
 * `?fresh=1` (botão "Atualizar") lê direto na Sellflux e descarta o cache, para que a mudança
 * vista agora também valha para as outras atendentes. Sem ele, a grade vem do cache de 30 s.
 */
export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("unidade");
  const data = url.searchParams.get("data") ?? hojeLocal();
  const fresh = url.searchParams.get("fresh") === "1";
  if (!slug) throw new AppError(400, { erro: "unidade_obrigatoria" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new AppError(400, { erro: "data_invalida" });
  if (fresh) invalidarSchedules();
  const unidade = await unidadeOuErro(slug);
  return NextResponse.json(await carregarGrade(unidade, data, { fresh }));
});

export const POST = handler(async (req) => {
  const body = novaReservaSchema.parse(await json(req));
  return NextResponse.json(await criarReserva(body), { status: 201 });
});
