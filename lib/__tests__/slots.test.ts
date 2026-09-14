import { describe, expect, it } from "vitest";
import { gerarHorarios, horariosVazios, montarGrade, slotsQueCabem, vagasEm, type Reserva, type Unidade } from "../slots";
import { dataCurta, diaDaSemana, localToUtcIso, utcToLocal } from "../tz";

const goiania: Unidade = {
  slug: "goiania", nome: "Goiânia", sellfluxUserId: 1, capacidade: 12, duracaoMin: 30,
  horarios: { ...horariosVazios(), "1": [{ inicio: "14:00", fim: "22:00" }], "6": [{ inicio: "10:00", fim: "12:00" }, { inicio: "14:00", fim: "15:00" }] },
};

function reserva(p: Partial<Reserva> & { horario: string; pessoas: number }): Reserva {
  return { id: Math.random(), nome: "X", pessoasIdentificadas: true, telefone: null, data: "2026-09-14", startIso: "", endIso: null, subject: "", description: null, status: "agendado", outcome: null, cancelado: false, leadIds: [], ...p };
}

describe("tz", () => {
  it("converte local → UTC e volta (Brasília = UTC-3)", () => {
    const iso = localToUtcIso("2026-09-14", "20:00");
    expect(iso).toBe("2026-09-14T23:00:00.000Z");
    expect(utcToLocal(iso)).toEqual({ data: "2026-09-14", horario: "20:00" });
  });
  it("vira o dia corretamente perto da meia-noite", () => {
    expect(utcToLocal("2026-09-15T01:30:00Z")).toEqual({ data: "2026-09-14", horario: "22:30" });
  });
  it("dia da semana e data curta", () => {
    expect(diaDaSemana("2026-09-14")).toBe(1); // segunda
    expect(diaDaSemana("2026-09-19")).toBe(6); // sábado
    expect(dataCurta("2026-09-14")).toBe("14/09");
  });
});

describe("gerarHorarios", () => {
  it("segunda 14h–22h a cada 30 min", () => {
    const h = gerarHorarios(goiania, "2026-09-14");
    expect(h[0]).toBe("14:00");
    expect(h[h.length - 1]).toBe("21:30");
    expect(h).toHaveLength(16);
  });
  it("sábado com dois intervalos", () => {
    expect(gerarHorarios(goiania, "2026-09-19")).toEqual(["10:00", "10:30", "11:00", "11:30", "14:00", "14:30"]);
  });
  it("fechado → vazio", () => {
    expect(gerarHorarios(goiania, "2026-09-15")).toEqual([]);
  });
});

describe("montarGrade", () => {
  it("soma pessoas, ignora canceladas e calcula vagas", () => {
    const { slots, foraDaGrade } = montarGrade(goiania, "2026-09-14", [
      reserva({ id: 1, horario: "20:00", pessoas: 9 }),
      reserva({ id: 2, horario: "20:00", pessoas: 2 }),
      reserva({ id: 3, horario: "20:00", pessoas: 5, status: "cancelado", cancelado: true }),
      reserva({ id: 4, horario: "20:15", pessoas: 1 }), // dentro do slot 20:00
      reserva({ id: 5, horario: "09:00", pessoas: 3 }), // fora da grade
      reserva({ id: 6, horario: "20:00", pessoas: 3, data: "2026-09-15" }), // outro dia
    ]);
    const s = slots.find((x) => x.horario === "20:00")!;
    expect(s.ocupacao).toBe(12);
    expect(s.vagas).toBe(0);
    expect(s.reservas).toHaveLength(4);
    expect(foraDaGrade.map((r) => r.id)).toEqual([5]);
    expect(slotsQueCabem(slots, 1).map((s) => s.horario)).not.toContain("20:00");
    expect(slotsQueCabem(slots, 12)).toHaveLength(15);
  });
  it("vagasEm ignora a própria reserva ao editar", () => {
    const { slots } = montarGrade(goiania, "2026-09-14", [reserva({ id: 1, horario: "20:00", pessoas: 9 })]);
    expect(vagasEm(slots, "20:00")).toBe(3);
    expect(vagasEm(slots, "20:00", 1)).toBe(12);
    expect(vagasEm(slots, "13:00")).toBeNull();
  });
});
