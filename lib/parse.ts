/**
 * Convenções de texto do agendamento na Sellflux.
 *
 *   subject:     "Fulano 9p"
 *   description: "🏎️ Reservado por: Fulano\n📆 Data: 14/09\n⏱ Horário: 20:00\n📲 Telefone: +55 62 98765-4321\n🙋‍♂️ Quantidade de participantes: 9"
 *
 * A quantidade de pessoas é a fonte da ocupação, então ela é lida do subject e, se falhar, da description.
 * A descrição é texto livre da equipe (pode ter sido escrita na Sellflux): o app só atualiza as linhas
 * padrão dos campos que mudaram (`atualizarDescription`) e deixa o resto como está.
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

export type CamposDescription = {
  nome: string;
  dataCurta: string; // 14/09
  horario: string; // 20:00
  telefoneFormatado: string; // +55 62 98765-4321
  pessoas: number;
};

/** As linhas padrão: como reconhecer cada uma numa descrição existente e como reescrevê-la. */
const LINHAS: { campo: keyof CamposDescription; re: RegExp; montar: (v: CamposDescription) => string }[] = [
  { campo: "nome", re: /^[^\n]*reservado por:[^\n]*$/im, montar: (v) => `🏎️ Reservado por: ${v.nome.trim()}` },
  { campo: "dataCurta", re: /^[^\n]*\bdata:[^\n]*$/im, montar: (v) => `📆 Data: ${v.dataCurta}` },
  { campo: "horario", re: /^[^\n]*hor[áa]rio:[^\n]*$/im, montar: (v) => `⏱ Horário: ${v.horario}` },
  { campo: "telefoneFormatado", re: /^[^\n]*telefone:[^\n]*$/im, montar: (v) => `📲 Telefone: ${v.telefoneFormatado}` },
  { campo: "pessoas", re: /^[^\n]*participantes:[^\n]*$/im, montar: (v) => `🙋‍♂️ Quantidade de participantes: ${v.pessoas}` },
];

export function montarDescription(v: CamposDescription): string {
  return LINHAS.map((l) => l.montar(v)).join("\n");
}

/**
 * Atualiza numa descrição existente só as linhas padrão dos campos em `alterados`; todo o resto do texto
 * (inclusive descrição escrita à mão na Sellflux) fica intacto. Linha que não existe é acrescentada no fim.
 * Descrição vazia com algum campo alterado → template completo.
 */
export function atualizarDescription(description: string | null | undefined, v: CamposDescription, alterados: Iterable<keyof CamposDescription>): string {
  const campos = new Set(alterados);
  let texto = (description ?? "").replace(/\r\n/g, "\n").trim();
  if (campos.size === 0) return texto;
  if (!texto) return montarDescription(v);
  for (const l of LINHAS) {
    if (!campos.has(l.campo)) continue;
    const nova = l.montar(v);
    texto = l.re.test(texto) ? texto.replace(l.re, nova) : `${texto}\n${nova}`;
  }
  return texto;
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

/** DDDs em uso no Brasil (Anatel). Fora daqui é erro de digitação. */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** O texto começa com código do país (`+55`, `0055`)? Aí o "55" nunca é DDD, mesmo com poucos dígitos digitados. */
function comCodigoDoPais(input: string): boolean {
  return /^\s*(\+|00)\s*55/.test(input);
}

/** Só os dígitos nacionais (DDD + número), tirando o 55 do país quando ele veio junto. Base da máscara e da validação. */
export function digitosNacionais(input: string): string {
  let d = input.replace(/\D/g, "");
  if (comCodigoDoPais(input)) d = d.replace(/^0*55/, "");
  else if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return d.slice(0, 11);
}

/**
 * Máscara progressiva para o campo de telefone: `(62) 98765-4321` (celular) ou `(62) 3222-1234` (fixo).
 * Aceita colar ou digitar em qualquer formato (`+55 62 98765-4321`, `5562987654321`, `62987654321`);
 * quem digita `+55` vê o prefixo mantido: `+55 (62) 98765-4321`.
 */
export function mascararTelefone(input: string): string {
  const prefixo = comCodigoDoPais(input) || /^\s*\+\s*5?$/.test(input) ? "+55 " : "";
  const d = digitosNacionais(input);
  if (d.length === 0) return prefixo;
  if (d.length <= 2) return `${prefixo}(${d}`;
  const ddd = d.slice(0, 2);
  const num = d.slice(2);
  if (num.length <= 4) return `${prefixo}(${ddd}) ${num}`;
  // até 10 dígitos formata 4-4; ao chegar no 11º, vira 5-4 (celular)
  const corte = num.length === 9 ? 5 : 4;
  return `${prefixo}(${ddd}) ${num.slice(0, corte)}-${num.slice(corte)}`;
}

export type TelefoneValidado = { ok: true; e164: string } | { ok: false; motivo: string };

/**
 * Validação estrita para gravar: DDD existente, 11 dígitos começando com 9 (celular) ou 10 começando
 * com 2–5 (fixo), sem sequências repetidas. Usada no formulário e no servidor.
 */
export function validarTelefone(input: string): TelefoneValidado {
  const d = digitosNacionais(input);
  if (d.length < 10) return { ok: false, motivo: "Informe o DDD e o número completo." };
  const ddd = Number(d.slice(0, 2));
  const num = d.slice(2);
  if (!DDDS.has(ddd)) return { ok: false, motivo: `DDD ${d.slice(0, 2)} não existe.` };
  if (num.length === 9 && num[0] !== "9") return { ok: false, motivo: "Celular com 9 dígitos precisa começar com 9." };
  if (num.length === 8 && !/^[2-5]/.test(num)) return { ok: false, motivo: "Número fixo começa com 2, 3, 4 ou 5; celular tem 9 dígitos." };
  if (/^(\d)\1+$/.test(num)) return { ok: false, motivo: "Número com todos os dígitos iguais." };
  return { ok: true, e164: `+55${d}` };
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
