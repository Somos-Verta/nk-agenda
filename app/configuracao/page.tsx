import { AppHeader } from "@/components/AppHeader";
import { ConfigClient } from "@/components/config/ConfigClient";
import { listarUnidades } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ConfiguracaoPage() {
  const unidades = await listarUnidades();
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
        <div>
          <h1 className="text-xl font-semibold">Configuração das unidades</h1>
          <p className="text-sm text-muted-foreground">Capacidade e horários não existem na Sellflux — são definidos aqui. Cada unidade precisa estar ligada ao seu usuário &quot;Recepção&quot; da Sellflux.</p>
        </div>
        <ConfigClient unidades={unidades} />
      </main>
    </>
  );
}
