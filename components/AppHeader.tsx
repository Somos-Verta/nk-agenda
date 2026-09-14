"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const links = [
    { href: "/agenda", label: "Agenda" },
    { href: "/configuracao", label: "Configuração" },
  ];
  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
        <Link href="/agenda" className="font-semibold">🏎️ NK Agenda</Link>
        <nav className="flex gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={cn("rounded-md px-3 py-1.5 text-sm hover:bg-accent", pathname.startsWith(l.href) && "bg-accent font-medium")}>{l.label}</Link>
          ))}
        </nav>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={sair}>Sair</Button>
      </div>
    </header>
  );
}
