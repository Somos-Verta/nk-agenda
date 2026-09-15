import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Marca do app: o piloto do logo da Nacional Kart + "NK Agenda". A imagem tem fundo #003399 (brand),
 * então fica perfeita sobre superfícies dessa cor (topbar); em outras, ganha cantos arredondados.
 */
export function BrandMark({ tom = "escuro", compacto = false, className }: { tom?: "claro" | "escuro"; /** em telas estreitas mostra só o piloto */ compacto?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", tom === "claro" ? "text-ink-foreground" : "text-foreground", className)}>
      <Image src="/marca.png" alt="NK Agenda" width={36} height={36} priority className="size-9 shrink-0 rounded-md" />
      <span className={cn(compacto && "hidden sm:inline")}>NK Agenda</span>
    </span>
  );
}
