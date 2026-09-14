"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ senha }) });
      if (!res.ok) { setErro("Senha incorreta."); return; }
      // só caminhos internos: barra a "//host", "/\\host" e qualquer coisa com esquema
      const next = params.get("next") ?? "";
      const interno = /^\/(?![\/\\])/.test(next) && new URL(next, location.origin).origin === location.origin;
      router.replace(interno ? next : "/agenda");
      router.refresh();
    } catch {
      setErro("Não foi possível entrar. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="senha">Senha</Label>
        <Input id="senha" type="password" autoFocus autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <Button type="submit" disabled={carregando || !senha}>{carregando ? "Entrando…" : "Entrar"}</Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>🏎️ NK Agenda</CardTitle>
          <CardDescription>Agenda de baterias da Nacional Kart</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense><LoginForm /></Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
