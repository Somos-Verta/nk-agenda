import { NextResponse } from "next/server";
import { vinculosReserva } from "@/lib/agenda";
import { AppError, handler } from "@/lib/http";

/** GET /api/agenda/:id/vinculos?unidade= → `{ leadId, chatId }` (ids na Sellflux; null quando não há contato). */
export const GET = handler(async (req, { params }) => {
  const { id } = await params;
  const slug = new URL(req.url).searchParams.get("unidade");
  if (!slug) throw new AppError(400, { erro: "unidade_obrigatoria" });
  return NextResponse.json(await vinculosReserva(id, slug));
});
