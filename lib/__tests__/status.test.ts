import { describe, expect, it } from "vitest";
import { normalizarSchedule } from "../sellflux";
import { STATUS_RESERVA, type Reserva, type StatusReserva } from "../slots";
import { aplicarStatusLocal, soNoApp, statusParaSellflux, statusSchema, type StatusLocal } from "../status";

function reserva(p: Partial<Reserva> & { id: number }): Reserva {
  return { nome: "X", pessoas: 2, pessoasIdentificadas: true, telefone: null, data: "2026-10-10", horario: "20:00", startIso: "", endIso: null, subject: "X 2p", description: null, status: "agendado", statusSellflux: "agendado", outcome: "scheduled", cancelado: false, leadIds: [], ...p };
}
const local = (id: number, status: StatusReserva, baseStatus: StatusReserva): StatusLocal => ({ id, data: "2026-10-10", status, baseStatus });

describe("statusParaSellflux — o que a API aceita (testado 10/10/2026)", () => {
  it("Agendada, Concluído e Cancelado vão para a Sellflux", () => {
    expect(statusParaSellflux("agendado")).toBe(1);
    expect(statusParaSellflux("concluido")).toBe(2);
    expect(statusParaSellflux("cancelado")).toBe("cancelado");
  });
  it("Reagendado, Não compareceu e Nenhum ficam só no registro do app", () => {
    expect(statusParaSellflux("reagendado")).toBeNull();
    expect(statusParaSellflux("nao_compareceu")).toBeNull();
    expect(statusParaSellflux("nenhum")).toBeNull();
  });
  it("cobre os 6 status do dropdown", () => {
    expect(STATUS_RESERVA).toHaveLength(6);
    for (const s of STATUS_RESERVA) expect(statusSchema.parse(s)).toBe(s);
    expect(() => statusSchema.parse("no_show")).toThrow();
  });
});

describe("aplicarStatusLocal", () => {
  it("sobrepõe o status quando a Sellflux continua como estava no registro", () => {
    const [r] = aplicarStatusLocal([reserva({ id: 1 })], [local(1, "nao_compareceu", "agendado")]);
    expect(r.status).toBe("nao_compareceu");
    expect(r.statusSellflux).toBe("agendado");
    expect(r.cancelado).toBe(false);
    expect(soNoApp(r)).toBe(true);
  });
  it("ignora o registro quando alguém mudou o status direto na Sellflux depois dele", () => {
    // o app gravou "não compareceu" com a Sellflux em Agendado; depois a equipe concluiu lá
    const [r] = aplicarStatusLocal([reserva({ id: 1, status: "concluido", statusSellflux: "concluido" })], [local(1, "nao_compareceu", "agendado")]);
    expect(r.status).toBe("concluido");
    expect(soNoApp(r)).toBe(false);
  });
  it("só Cancelado marca a reserva como cancelada (libera kart)", () => {
    const cancelada = reserva({ id: 1, status: "cancelado", statusSellflux: "cancelado", cancelado: true });
    // reativada só no app: sai de cancelado
    expect(aplicarStatusLocal([cancelada], [local(1, "reagendado", "cancelado")])[0].cancelado).toBe(false);
    // cancelado pelo registro
    expect(aplicarStatusLocal([reserva({ id: 2 })], [local(2, "cancelado", "agendado")])[0].cancelado).toBe(true);
  });
  it("não mexe nas reservas sem registro, nem no id de outro dia", () => {
    const rs = [reserva({ id: 1 }), reserva({ id: 2 })];
    const out = aplicarStatusLocal(rs, [local(9, "concluido", "agendado")]);
    expect(out).toEqual(rs);
  });
  it("compara o id como texto (a Sellflux devolve número, o banco bigint)", () => {
    const [r] = aplicarStatusLocal([reserva({ id: 227443215 })], [{ ...local(1, "reagendado", "agendado"), id: "227443215" }]);
    expect(r.status).toBe("reagendado");
  });
});

describe("normalizarSchedule — statusSellflux", () => {
  const base = { id: 1, subject: "Fulano 3p", start_date: "2026-10-10T23:00:00.000Z", end_date: "2026-10-10T23:30:00.000Z" };
  it.each([
    ["scheduled", "agendado"], ["completed", "concluido"], ["canceled", "cancelado"], ["no_show", "nao_compareceu"], ["rescheduled", "reagendado"],
  ] as const)("meeting_outcome %s → %s", (outcome, esperado) => {
    const r = normalizarSchedule({ ...base, meeting_outcome: outcome })!;
    expect(r.statusSellflux).toBe(esperado);
    expect(r.status).toBe(esperado); // sem registro local, o status exibido é o da Sellflux
    expect(r.cancelado).toBe(esperado === "cancelado");
  });
  it("❌ no título cancela, mesmo com outro outcome (convenção da equipe)", () => {
    const r = normalizarSchedule({ ...base, subject: "❌Mikaelly 2 pessoas", meeting_outcome: "no_show" })!;
    expect(r.statusSellflux).toBe("cancelado");
  });
  it("sem meeting_outcome (listagem não traz) cai em agendado", () => {
    expect(normalizarSchedule(base)!.statusSellflux).toBe("agendado");
  });
});
