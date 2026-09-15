import { redirect } from "next/navigation";
import { listarUnidades } from "@/lib/db";

export const dynamic = "force-dynamic";

/** `/agenda` → primeira unidade. Links antigos `/agenda?u=<slug>&d=` continuam funcionando. */
export default async function AgendaIndex({ searchParams }: { searchParams: Promise<{ u?: string; d?: string }> }) {
  const [unidades, { u, d }] = await Promise.all([listarUnidades(), searchParams]);
  const slug = unidades.some((x) => x.slug === u) ? u! : unidades[0]?.slug;
  if (!slug) redirect("/configuracao");
  redirect(d ? `/agenda/${slug}?d=${encodeURIComponent(d)}` : `/agenda/${slug}`);
}
