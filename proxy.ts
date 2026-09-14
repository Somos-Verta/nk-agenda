import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NOME, tokenValido } from "@/lib/auth";

/** Exige sessão em tudo, exceto login e assets. APIs recebem 401; páginas vão para /login. */
export async function proxy(request: NextRequest) {
  const ok = await tokenValido(request.cookies.get(COOKIE_NOME)?.value);
  if (ok) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
