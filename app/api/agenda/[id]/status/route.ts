import { NextResponse } from "next/server";
import { z } from "zod";
import { definirStatus } from "@/lib/agenda";
import { handler, json } from "@/lib/http";
import { statusSchema } from "@/lib/status";

const bodySchema = z.object({ unidade: z.string().min(1), status: statusSchema });

/** PUT /api/agenda/:id/status  { unidade, status } → a reserva com o novo status. */
export const PUT = handler(async (req, { params }) => {
  const { id } = await params;
  const body = bodySchema.parse(await json(req));
  return NextResponse.json(await definirStatus(id, body.unidade, body.status));
});
