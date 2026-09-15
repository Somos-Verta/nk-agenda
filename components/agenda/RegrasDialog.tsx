"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Unidade } from "@/lib/slots";
import { RingVagas } from "./RingVagas";
import { STATUS_ORDEM, StatusTag } from "./status";

/** As regras de cálculo da vaga, no vocabulário da atendente. Abre pelo botão "Regras" da agenda. */
export function RegrasDialog({ unidade, onClose }: { unidade: Unidade; onClose: () => void }) {
  const cap = Math.min(unidade.capacidade, 12);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Como a agenda calcula as vagas</DialogTitle>
          <DialogDescription>
            {unidade.nome}: baterias de {unidade.duracaoMin} min com {unidade.capacidade} karts cada. Isso vem da Configuração; as reservas vêm da Sellflux.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 rounded-lg border bg-muted/40 p-3">
          <div className="flex gap-2">
            <RingVagas capacidade={cap} ocupacao={2} />
            <RingVagas capacidade={cap} ocupacao={cap - 3} />
            <RingVagas capacidade={cap} ocupacao={cap} />
          </div>
          <p className="text-xs text-muted-foreground">
            O número é quantas vagas restam na bateria. Cada traço do anel é um kart; os coloridos já estão reservados —
            verde com folga, âmbar com menos da metade livre, vermelho lotada.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-lg border bg-muted/40 p-3">
          {STATUS_ORDEM.map((st) => <StatusTag key={st} status={st} className="text-sm" />)}
          <p className="basis-full text-xs text-muted-foreground">Status como na Sellflux. Só <strong>Cancelado</strong> libera os karts da bateria.</p>
        </div>

        <ol className="grid gap-2.5 text-sm">
          {[
            <>Uma reserva ocupa o número de pessoas do título — <em>“Fulano 9p”</em> ocupa 9 karts naquela bateria.</>,
            <>Vagas = karts da bateria − pessoas reservadas. É o número dentro do anel, ao lado do horário.</>,
            <>Reserva <strong>cancelada</strong> (❌ no título ou status Cancelado) não ocupa kart e aparece riscada.</>,
            <><strong>Não compareceu</strong> e <strong>Concluída</strong> continuam ocupando. Só cancelar libera os karts.</>,
            <>Agendamento criado à mão na Sellflux, sem <em>“Np”</em> no título, conta como 1 pessoa e aparece com ⚠ “sem quantidade” — abra e ajuste.</>,
            <>Reserva fora dos horários de funcionamento aparece em <em>“Fora da grade”</em>, sem ocupar bateria.</>,
            <>Ao reservar, a vaga é conferida de novo no servidor. Se alguém reservou antes, você recebe as baterias que ainda cabem.</>,
          ].map((texto, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-ink-foreground tabular-nums">{i + 1}</span>
              <span className="text-foreground/90">{texto}</span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
