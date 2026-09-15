import { describe, expect, it } from "vitest";
import { atualizarDescription, formatarTelefone, isCancelado, MARCA_CANCELADO, mascararTelefone, montarDescription, montarSubject, normalizarTelefone, parseNome, parsePessoas, parseTelefone, validarTelefone } from "../parse";

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
  it("atualizarDescription reescreve só as linhas dos campos alterados", () => {
    const v = { nome: "Fulano", dataCurta: "14/09", horario: "20:00", telefoneFormatado: "+55 62 98765-4321", pessoas: 9 };
    const original = montarDescription({ ...v, pessoas: 4, horario: "19:00" }) + "\nAniversário do Pedro — bolo na pista";
    const nova = atualizarDescription(original, v, ["pessoas", "horario"]);
    expect(nova).toBe("🏎️ Reservado por: Fulano\n📆 Data: 14/09\n⏱ Horário: 20:00\n📲 Telefone: +55 62 98765-4321\n🙋‍♂️ Quantidade de participantes: 9\nAniversário do Pedro — bolo na pista");
    expect(parsePessoas("x", nova)).toBe(9);
    // nada alterado → texto intacto (só trim)
    expect(atualizarDescription("  texto qualquer \n", v, [])).toBe("texto qualquer");
  });
  it("atualizarDescription preserva descrição escrita à mão e acrescenta a linha que falta", () => {
    const v = { nome: "Ana", dataCurta: "14/09", horario: "20:00", telefoneFormatado: "+55 11 91234-5678", pessoas: 3 };
    expect(atualizarDescription("Grupo da empresa, chegam 19h", v, ["telefoneFormatado"])).toBe("Grupo da empresa, chegam 19h\n📲 Telefone: +55 11 91234-5678");
    // vazia com campo alterado → template completo; vazia sem alteração → vazia
    expect(atualizarDescription(null, v, ["pessoas"])).toBe(montarDescription(v));
    expect(atualizarDescription("", v, [])).toBe("");
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

describe("telefone no formulário", () => {
  it("máscara progressiva e colagem em qualquer formato", () => {
    expect(mascararTelefone("")).toBe("");
    expect(mascararTelefone("6")).toBe("(6");
    expect(mascararTelefone("62")).toBe("(62");
    expect(mascararTelefone("6298")).toBe("(62) 98");
    expect(mascararTelefone("62987654")).toBe("(62) 9876-54");
    expect(mascararTelefone("6298765432")).toBe("(62) 9876-5432");
    expect(mascararTelefone("62987654321")).toBe("(62) 98765-4321");
    expect(mascararTelefone("+55 62 98765-4321")).toBe("+55 (62) 98765-4321");
    expect(mascararTelefone("5562987654321")).toBe("(62) 98765-4321");
    // digitando "+55 62…" tecla a tecla, o 55 não vira DDD
    expect(mascararTelefone("+")).toBe("+55 ");
    expect(mascararTelefone("+55")).toBe("+55 ");
    expect(mascararTelefone("+55 6")).toBe("+55 (6");
    expect(mascararTelefone("+55 (62) 9816")).toBe("+55 (62) 9816");
    expect(validarTelefone("+55 (62) 98765-4321")).toEqual({ ok: true, e164: "+5562987654321" });
    expect(mascararTelefone("(11) 3222-1234")).toBe("(11) 3222-1234");
    // não passa de 11 dígitos
    expect(mascararTelefone("629876543219999")).toBe("(62) 98765-4321");
  });
  it("valida DDD, tamanho, 9º dígito e sequências", () => {
    expect(validarTelefone("(62) 98765-4321")).toEqual({ ok: true, e164: "+5562987654321" });
    expect(validarTelefone("11 3222-1234")).toEqual({ ok: true, e164: "+551132221234" });
    expect(validarTelefone("62 9816")).toMatchObject({ ok: false });
    expect(validarTelefone("(20) 98765-4321")).toMatchObject({ ok: false, motivo: expect.stringContaining("DDD") });
    expect(validarTelefone("(62) 88167-4628")).toMatchObject({ ok: false, motivo: expect.stringContaining("começar com 9") });
    expect(validarTelefone("(62) 9876-5432")).toMatchObject({ ok: false });
    expect(validarTelefone("(62) 99999-9999")).toMatchObject({ ok: false, motivo: expect.stringContaining("iguais") });
  });
});
