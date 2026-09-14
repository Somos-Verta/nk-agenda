import { AppHeader } from "@/components/AppHeader";
import { AgendaClient } from "@/components/agenda/AgendaClient";
import { listarUnidades } from "@/lib/db";
import { hojeLocal } from "@/lib/tz";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const unidades = await listarUnidades();
  return (
    <>
      <AppHeader />
      <AgendaClient unidades={unidades} hoje={hojeLocal()} />
    </>
  );
}
