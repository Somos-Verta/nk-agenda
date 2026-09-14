import { NextResponse } from "next/server";
import { COOKIE_NOME, cookieOpts, criarToken, senhaConfere } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { senha?: unknown } | null;
  const senha = typeof body?.senha === "string" ? body.senha : "";
  if (!senha || !(await senhaConfere(senha))) {
    return NextResponse.json({ erro: "senha_invalida" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NOME, await criarToken(), cookieOpts);
  return res;
}
