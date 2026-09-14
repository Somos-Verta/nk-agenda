"use client";

/** fetch para as rotas /api/* com erro tipado (payload JSON do servidor). */
export class ApiError extends Error {
  constructor(public status: number, public payload: Record<string, unknown>) {
    super(String(payload.mensagem ?? payload.erro ?? `Erro ${status}`));
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401) {
    // sessão expirou: recarga completa limpa o estado da tela
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new ApiError(401, payload);
  }
  if (!res.ok) throw new ApiError(res.status, payload);
  return payload as T;
}
