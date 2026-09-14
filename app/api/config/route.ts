import { NextResponse } from "next/server";
import { z } from "zod";
import { listarUnidades, salvarUnidade, unidadePatchSchema } from "@/lib/db";
import { handler, json } from "@/lib/http";

export const GET = handler(async () => NextResponse.json({ unidades: await listarUnidades() }));

const putSchema = z.object({ slug: z.string().min(1), patch: unidadePatchSchema });

export const PUT = handler(async (req) => {
  const { slug, patch } = putSchema.parse(await json(req));
  return NextResponse.json(await salvarUnidade(slug, patch));
});
