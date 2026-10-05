/**
 * Cache em memória com TTL e single-flight (uma chamada em voo por chave).
 *
 * Usado só para as leituras do Supabase (`nk_unidades`: 4 linhas que mudam na tela Configuração).
 * Vale dentro da instância do servidor — na Vercel, entre invocações da mesma instância quente.
 * O cache das respostas da Sellflux é outro: o Data Cache do Next (`next: { revalidate, tags }`
 * em `sf()`), que é compartilhado entre instâncias e invalidável por tag.
 */
type Entrada<T> = { valor: T; expiraEm: number };

const valores = new Map<string, Entrada<unknown>>();
const emVoo = new Map<string, Promise<unknown>>();

export async function memo<T>(chave: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const atual = valores.get(chave) as Entrada<T> | undefined;
  if (atual && atual.expiraEm > Date.now()) return atual.valor;
  // requisições concorrentes com o cache vazio esperam a mesma chamada, em vez de abrirem uma cada
  const voando = emVoo.get(chave) as Promise<T> | undefined;
  if (voando) return voando;
  const p = fn()
    .then((valor) => {
      valores.set(chave, { valor, expiraEm: Date.now() + ttlMs });
      return valor;
    })
    .finally(() => emVoo.delete(chave)); // erro não é cacheado: a próxima tentativa busca de novo
  emVoo.set(chave, p);
  return p;
}

/** Descarta as entradas cujas chaves começam com `prefixo` (chamar depois de gravar). */
export function invalidar(prefixo: string): void {
  for (const k of [...valores.keys()]) if (k.startsWith(prefixo)) valores.delete(k);
}
