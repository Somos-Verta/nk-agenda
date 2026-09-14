import { NextResponse } from "next/server";
import { COOKIE_NOME, cookieOpts } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NOME, "", { ...cookieOpts, maxAge: 0 });
  return res;
}
