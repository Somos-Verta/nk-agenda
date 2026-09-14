import { NextResponse } from "next/server";
import { cancelarReserva, editarReserva, editarReservaSchema } from "@/lib/agenda";
import { AppError, handler, json } from "@/lib/http";

export const PUT = handler(async (req, { params }) => {
  const { id } = await params;
  const body = editarReservaSchema.parse(await json(req));
  return NextResponse.json(await editarReserva(id, body));
});

export const DELETE = handler(async (req, { params }) => {
  const { id } = await params;
  const slug = new URL(req.url).searchParams.get("unidade");
  if (!slug) throw new AppError(400, { erro: "unidade_obrigatoria" });
  return NextResponse.json(await cancelarReserva(id, slug));
});
