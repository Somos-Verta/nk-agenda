import { NextResponse } from "next/server";
import { handler } from "@/lib/http";
import { listarUsuarios } from "@/lib/sellflux";

export const GET = handler(async (req) => {
  const search = new URL(req.url).searchParams.get("search") ?? "";
  const usuarios = await listarUsuarios(search);
  return NextResponse.json({ usuarios: usuarios.map(({ id, nome, email }) => ({ id, nome, email })) });
});
