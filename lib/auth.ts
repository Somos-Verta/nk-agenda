/**
 * Sessão por senha compartilhada. Cookie `nk_session` = `<timestamp>.<hmac>`, assinado com SESSION_SECRET.
 * Usa Web Crypto para funcionar tanto no proxy (edge) quanto nos route handlers (node).
 */

export const COOKIE_NOME = "nk_session";
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET ausente ou curta demais (mín. 16 caracteres)");
  return s;
}

async function hmac(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function senhaConfere(senha: string): Promise<boolean> {
  const esperada = process.env.APP_PASSWORD;
  if (!esperada) throw new Error("APP_PASSWORD ausente");
  // compara hashes para não vazar o tamanho da senha pelo tempo de resposta
  return iguais(await hmac(`pw:${senha}`), await hmac(`pw:${esperada}`));
}

export async function criarToken(): Promise<string> {
  const ts = String(Date.now());
  return `${ts}.${await hmac(ts)}`;
}

export async function tokenValido(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [ts, sig] = token.split(".");
  if (!ts || !sig || !/^\d+$/.test(ts)) return false;
  if (Date.now() - Number(ts) > VALIDADE_MS) return false;
  return iguais(sig, await hmac(ts));
}

export const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: VALIDADE_MS / 1000,
};
