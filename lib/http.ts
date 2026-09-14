import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SellfluxError } from "./sellflux";

/** Erro de domínio com status HTTP e payload JSON. */
export class AppError extends Error {
  constructor(public status: number, public payload: Record<string, unknown>) {
    super(String(payload.mensagem ?? payload.erro ?? status));
  }
}

/** Envolve um handler e converte erros conhecidos em respostas JSON. */
export function handler(fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof AppError) return NextResponse.json(e.payload, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ erro: "dados_invalidos", detalhes: e.issues }, { status: 400 });
      if (e instanceof SellfluxError) {
        console.error("[sellflux]", e.status, e.body);
        return NextResponse.json({ erro: "sellflux", mensagem: e.message, status: e.status, body: e.body }, { status: 502 });
      }
      console.error("[api]", e);
      return NextResponse.json({ erro: "interno", mensagem: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  };
}

export async function json<T>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { throw new AppError(400, { erro: "json_invalido" }); }
}
