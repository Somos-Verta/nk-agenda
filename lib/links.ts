/** Links para a interface da Sellflux (seguro no browser: não usa token). */
export const SELLFLUX_APP = "https://app.sellflux.com";

/** Página do lead na Sellflux, já na aba de agendamentos. */
export function urlLeadSellflux(leadId: number | string): string {
  return `${SELLFLUX_APP}/leads/${leadId}?activity_tab=meetings`;
}

/** Conversa (chat) do lead na Sellflux. O id vem dos vínculos do agendamento, não é o id do lead. */
export function urlChatSellflux(chatId: number | string): string {
  return `${SELLFLUX_APP}/chats/${chatId}`;
}

/**
 * Agenda da Sellflux filtrada: dia, responsável (usuário da unidade) e busca pelo nome — não existe rota por id de
 * agendamento, então o filtro é o jeito de cair perto do registro certo.
 */
export function urlAgendaSellflux(o: { data: string; respUserId: number | null; busca?: string }): string {
  const q = new URLSearchParams({ from: o.data, to: o.data, view: "list", calendar: "day" });
  if (o.respUserId) q.set("resp", String(o.respUserId));
  if (o.busca?.trim()) q.set("q", o.busca.trim());
  return `${SELLFLUX_APP}/schedule?${q.toString()}`;
}
