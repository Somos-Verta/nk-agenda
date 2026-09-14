import { describe, expect, it } from "vitest";
import { formatarTelefone, isCancelado, MARCA_CANCELADO, montarDescription, montarSubject, normalizarTelefone, parseNome, parsePessoas, parseTelefone } from "../parse";

describe("parsePessoas", () => {
  it("lê do subject", () => {
    expect(parsePessoas("Fulano 9p", null)).toBe(9);
    expect(parsePessoas("Maria Silva 12P", null)).toBe(12);
    expect(parsePessoas("CANCELADO - Fulano 9p", null)).toBe(9);
    // formatos vistos na agenda real
    expect(parsePessoas("Beltrana Silva 2p ❌", null)).toBe(2);
    expect(parsePessoas("Sicrano 17 pessoas", null)).toBe(17);
    expect(parsePessoas("MARIA 1P", null)).toBe(1);
    expect(parsePessoas("joao 12p", null)).toBe(12);
  });
  it("não confunde telefone ou palavras com p", () => {
    expect(parsePessoas("Pedro 62987654321", null)).toBeNull();
    expect(parsePessoas("Paula Prado", null)).toBeNull();
  });
  it("cai na description", () => {
    expect(parsePessoas("Reunião", "🙋‍♂️ Quantidade de participantes: 4")).toBe(4);
  });
  it("null quando não segue a convenção", () => {
    expect(parsePessoas("Reunião com cliente", "Apresentação")).toBeNull();
    expect(parsePessoas("Pedro Lopes", null)).toBeNull();
  });
});

describe("subject/description", () => {
  it("monta o título e a descrição no formato combinado", () => {
    expect(montarSubject(" Fulano ", 9)).toBe("Fulano 9p");
    expect(montarDescription({ nome: "Fulano", dataCurta: "14/09", horario: "20:00", telefoneFormatado: "+55 62 98765-4321", pessoas: 9 })).toBe(
      "🏎️ Reservado por: Fulano\n📆 Data: 14/09\n⏱ Horário: 20:00\n📲 Telefone: +55 62 98765-4321\n🙋‍♂️ Quantidade de participantes: 9",
    );
  });
  it("parseNome remove sufixo e prefixo", () => {
    expect(parseNome("Fulano 9p")).toBe("Fulano");
    expect(parseNome("CANCELADO - Fulano 9p")).toBe("Fulano");
    expect(parseNome("Ana Paula")).toBe("Ana Paula");
    expect(isCancelado("cancelado - x 1p")).toBe(true);
    expect(isCancelado("Beltrana Silva 2p ❌")).toBe(true);
    expect(isCancelado("❌julia 2p")).toBe(true);
    expect(isCancelado(`Fulano 9p ${MARCA_CANCELADO}`)).toBe(true);
    expect(parseNome("❌julia 2p")).toBe("julia");
    expect(isCancelado("Fulano 9p")).toBe(false);
    expect(parseNome("Beltrana Silva 2p ❌")).toBe("Beltrana Silva");
    expect(parseNome("Sicrano 17 pessoas")).toBe("Sicrano");
  });
  it("parseTelefone lê a linha da descrição", () => {
    expect(parseTelefone("📲 Telefone: +55 62 98765-4321\n🙋‍♂️ Quantidade de participantes: 9")).toBe("+5562987654321");
    expect(parseTelefone("sem telefone")).toBeNull();
  });
});

describe("telefone", () => {
  it("normaliza formatos brasileiros", () => {
    expect(normalizarTelefone("(62) 98765-4321")).toBe("+5562987654321");
    expect(normalizarTelefone("62987654321")).toBe("+5562987654321");
    expect(normalizarTelefone("+55 62 98765-4321")).toBe("+5562987654321");
    expect(normalizarTelefone("5562987654321")).toBe("+5562987654321");
    expect(normalizarTelefone("1133334444")).toBe("+551133334444");
    expect(normalizarTelefone("123")).toBeNull();
  });
  it("formata para a descrição", () => {
    expect(formatarTelefone("+5562987654321")).toBe("+55 62 98765-4321");
    expect(formatarTelefone("+551133334444")).toBe("+55 11 3333-4444");
  });
});
