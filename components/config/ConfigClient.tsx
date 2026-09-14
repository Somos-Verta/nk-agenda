"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import type { Unidade } from "@/lib/slots";
import { UnidadeForm } from "./UnidadeForm";

export type UsuarioOpcao = { id: number; nome: string; email: string | null };

export function ConfigClient({ unidades: iniciais }: { unidades: Unidade[] }) {
  const [unidades, setUnidades] = useState(iniciais);
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[] | null>(null);
  const [erroUsuarios, setErroUsuarios] = useState<string | null>(null);

  useEffect(() => {
    api<{ usuarios: UsuarioOpcao[] }>("/api/sellflux/users")
      .then((r) => setUsuarios(r.usuarios))
      .catch((e) => setErroUsuarios(e instanceof ApiError ? e.message : String(e)));
  }, []);

  return (
    <div className="grid gap-4">
      {erroUsuarios && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          A Sellflux não devolveu a lista de usuários ({erroUsuarios}). Informe o id do usuário &quot;Recepção&quot; de cada unidade manualmente (Sellflux → Equipe).
        </p>
      )}
      {unidades.map((u) => (
        <UnidadeForm key={u.slug} unidade={u} usuarios={usuarios} onSalva={(nova) => setUnidades((all) => all.map((x) => (x.slug === nova.slug ? nova : x)))} />
      ))}
    </div>
  );
}
