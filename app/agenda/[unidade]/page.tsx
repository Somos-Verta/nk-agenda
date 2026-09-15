import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AgendaClient } from "@/components/agenda/AgendaClient";
import { listarUnidades } from "@/lib/db";
import { hojeLocal } from "@/lib/tz";

export const dynamic = "force-dynamic";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** `/agenda/goiania?d=2026-09-14` — uma rota por unidade; a data fica na query. */
export default async function AgendaUnidadePage({ params, searchParams }: { params: Promise<{ unidade: string }>; searchParams: Promise<{ d?: string }> }) {
  const [unidades, { unidade: slug }, { d }] = await Promise.all([listarUnidades(), params, searchParams]);
  const unidade = unidades.find((u) => u.slug === slug);
  if (!unidade) notFound();
  return (
    <>
      <AppHeader unidades={unidades} />
      <AgendaClient unidade={unidade} hoje={hojeLocal()} dataInicial={d && DATA.test(d) ? d : undefined} />
    </>
  );
}
