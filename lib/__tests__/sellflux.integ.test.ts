/**
 * Integração real com a Sellflux — só roda com SELLFLUX_TOKEN e SELLFLUX_ACTING_USER_ID no ambiente.
 *   set -a; source .env; source .env.local; set +a; pnpm vitest run lib/__tests__/sellflux.integ.test.ts
 * Só leitura: não cria nada.
 */
import { describe, expect, it } from "vitest";
import { listarReservas } from "../sellflux";
import { montarGrade, horariosVazios } from "../slots";
import { hojeLocal, localToUtcIso } from "../tz";

const PENHA = 56445;
const GOIANIA = 56173;

describe.skipIf(!process.env.SELLFLUX_TOKEN || !process.env.SELLFLUX_ACTING_USER_ID)("Sellflux (real)", () => {
  it("lista a agenda de hoje das unidades", { timeout: 60_000 }, async () => {
    const data = hojeLocal();
    for (const [nome, uid] of [["Penha", PENHA], ["Goiânia", GOIANIA]] as const) {
      const reservas = await listarReservas({ unidadeUserId: uid, startIso: localToUtcIso(data, "00:00"), endIso: localToUtcIso(data, "23:59") });
      const unidade = { slug: nome.toLowerCase(), nome, sellfluxUserId: uid, capacidade: 12, duracaoMin: 30, horarios: { ...horariosVazios(), [String(new Date().getDay())]: [{ inicio: "10:00", fim: "23:00" }] } };
      const { slots, foraDaGrade } = montarGrade(unidade, data, reservas);
      console.log(`\n${nome} ${data}: ${reservas.length} reservas, ${foraDaGrade.length} fora da grade`);
      for (const r of reservas) console.log(`  ${r.horario} ${r.nome.padEnd(28)} ${r.pessoas}p${r.pessoasIdentificadas ? "" : " (?)"}${r.cancelado ? " CANCELADA" : ""} [${r.status}/${r.outcome ?? "?"}] tel=${r.telefone ?? "-"} leads=${r.leadIds.join(",") || "-"}`);
      for (const s of slots.filter((s) => s.ocupacao > 0)) console.log(`  slot ${s.horario}: ${s.ocupacao}/${s.capacidade} (${s.vagas} vagas)`);
      for (const r of reservas) { expect(r.data).toBe(data); expect(r.pessoas).toBeGreaterThan(0); }
    }
  });
});
