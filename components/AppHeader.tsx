"use client";

import { LogOutIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BrandMark } from "@/components/BrandMark";
import type { Unidade } from "@/lib/slots";
import { cn } from "@/lib/utils";

const item = "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/60";
const inativo = "text-white/70 hover:bg-white/10 hover:text-white";
const ativo = "bg-white/15 font-medium text-white";

/** Uma rota por unidade (`/agenda/<slug>`), mantendo a data escolhida (`?d=`) ao trocar de unidade. */
function UnidadeLinks({ unidades }: { unidades: Pick<Unidade, "slug" | "nome">[] }) {
  const pathname = usePathname();
  const d = useSearchParams().get("d");
  return (
    <>
      {unidades.map((u) => {
        const href = `/agenda/${u.slug}`;
        const on = pathname === href;
        return (
          <Link key={u.slug} href={d ? `${href}?d=${d}` : href} aria-current={on ? "page" : undefined} className={cn(item, on ? ativo : inativo)}>
            {u.nome}
          </Link>
        );
      })}
    </>
  );
}

export function AppHeader({ unidades }: { unidades: Pick<Unidade, "slug" | "nome">[] }) {
  const pathname = usePathname();
  const router = useRouter();
  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  const naConfig = pathname.startsWith("/configuracao");
  return (
    <header className="bg-brand text-ink-foreground shadow-[inset_0_-3px_0_0_var(--ink)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 pb-[3px]">
        <Link href="/agenda" className="mr-2 shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/60">
          <BrandMark tom="claro" compacto />
        </Link>
        <nav className="flex min-w-0 gap-0.5 overflow-x-auto [scrollbar-width:none]" aria-label="Unidades">
          <Suspense fallback={null}><UnidadeLinks unidades={unidades} /></Suspense>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Link href="/configuracao" aria-current={naConfig ? "page" : undefined} className={cn(item, naConfig ? ativo : inativo)} title="Configuração">
            <SettingsIcon className="size-4" aria-hidden />
            <span className="hidden sm:inline">Configuração</span>
          </Link>
          <button type="button" onClick={sair} className={cn(item, inativo)}>
            <LogOutIcon className="size-4" aria-hidden />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
