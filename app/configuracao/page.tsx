import { AppHeader } from "@/components/AppHeader";
import { ConfigClient } from "@/components/config/ConfigClient";
import { listarUnidades } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ConfiguracaoPage() {
  const unidades = await listarUnidades();
  return (
    <>
      <AppHeader unidades={unidades} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Configuração das unidades</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Karts por bateria, duração, horários e preço por pessoa não existem na Sellflux — são definidos aqui. Os três primeiros
            valem para o cálculo de vagas; o preço alimenta a previsão de faturamento. Cada unidade precisa estar ligada ao seu
            usuário &quot;Recepção&quot; da Sellflux, de onde vêm as reservas.
          </p>
        </div>
        <ConfigClient unidades={unidades} />
      </main>
    </>
  );
}
