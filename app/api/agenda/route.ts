import { NextResponse } from "next/server";
import { carregarGrade, criarReserva, novaReservaSchema, unidadeOuErro } from "@/lib/agenda";
import { AppError, handler, json } from "@/lib/http";
import { hojeLocal } from "@/lib/tz";

export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("unidade");
  const data = url.searchParams.get("data") ?? hojeLocal();
  if (!slug) throw new AppError(400, { erro: "unidade_obrigatoria" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new AppError(400, { erro: "data_invalida" });
  const unidade = await unidadeOuErro(slug);
  return NextResponse.json(await carregarGrade(unidade, data));
});

export const POST = handler(async (req) => {
  const body = novaReservaSchema.parse(await json(req));
  return NextResponse.json(await criarReserva(body), { status: 201 });
});
