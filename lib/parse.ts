/**
 * Convenções de texto do agendamento na Sellflux.
 *
 *   subject:     "Fulano 9p"
 *   description: "🏎️ Reservado por: Fulano\n📆 Data: 14/09\n⏱ Horário: 20:00\n📲 Telefone: +55 62 98765-4321\n🙋‍♂️ Quantidade de participantes: 9"
 *
 * A quantidade de pessoas é a fonte da ocupação, então ela é lida do subject e, se falhar, da description.
 */

/** Marcador de cancelamento usado pela equipe nos títulos ("Beltrana 2p ❌"). */
export const MARCA_CANCELADO = "❌";

// "Fulano 9p", "MARIA 1P", "Sicrano 17 pessoas", "Beltrana 2p ❌" — o número + p/pessoas em qualquer posição
const RE_SUBJECT_PESSOAS = /(\d+)\s*p(?:essoas?)?(?![\p{L}\d])/iu;
// a equipe marca cancelamento com ❌ no título
const RE_MARCA_CANCELADO = /❌|\bcancelad[oa]\b/iu;
const RE_DESC_PESSOAS = /participantes:\s*(\d+)/i;
const RE_DESC_TELEFONE = /telefone:\s*([+\d\s()-]+)/i;

export function montarSubject(nome: string, pessoas: number): string {
  return `${nome.trim()} ${pessoas}p`;
}

export function montarDescription(r: {
  nome: string;
  dataCurta: string; // 14/09
  horario: string; // 20:00
  telefoneFormatado: string; // +55 62 98765-4321
  pessoas: number;
}): string {
  return [
    `🏎️ Reservado por: ${r.nome.trim()}`,
    `📆 Data: ${r.dataCurta}`,
    `⏱ Horário: ${r.horario}`,
    `📲 Telefone: ${r.telefoneFormatado}`,
    `🙋‍♂️ Quantidade de participantes: ${r.pessoas}`,
  ].join("\n");
}

/** Lê a quantidade de pessoas. `null` quando o agendamento não segue a convenção (criado à mão na Sellflux). */
export function parsePessoas(subject: string | null | undefined, description: string | null | undefined): number | null {
  const s = subject?.match(RE_SUBJECT_PESSOAS);
  if (s) return Number(s[1]);
  const d = description?.match(RE_DESC_PESSOAS);
  if (d) return Number(d[1]);
  return null;
}

export function isCancelado(subject: string | null | undefined): boolean {
  return RE_MARCA_CANCELADO.test(subject ?? "");
}

/** "CANCELADO - Fulano 9p" → "Fulano" */
export function parseNome(subject: string | null | undefined): string {
  return (subject ?? "")
    .replace(/^cancelad[oa]\s*-?\s*/iu, "")
    .replace(/❌/gu, "")
    .replace(RE_SUBJECT_PESSOAS, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseTelefone(description: string | null | undefined): string | null {
  const m = description?.match(RE_DESC_TELEFONE);
  if (!m) return null;
  const digits = m[1].replace(/\D/g, "");
  return digits ? normalizarTelefone(digits) : null;
}

/**
 * Qualquer formato BR → E.164 `+55DDNNNNNNNNN`.
 * Aceita "(62) 98765-4321", "62987654321", "5562987654321", "+55 62 98765-4321".
 * Retorna `null` se não tiver DDD + número (10 ou 11 dígitos nacionais).
 */
export function normalizarTelefone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  return `+55${d}`;
}

/** `+5562987654321` → `+55 62 98765-4321` (o formato da descrição). */
export function formatarTelefone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  const nacional = d.startsWith("55") ? d.slice(2) : d;
  const ddd = nacional.slice(0, 2);
  const num = nacional.slice(2);
  const meio = num.length === 9 ? `${num.slice(0, 5)}-${num.slice(5)}` : `${num.slice(0, 4)}-${num.slice(4)}`;
  return `+55 ${ddd} ${meio}`;
}
