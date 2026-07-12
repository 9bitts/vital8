import { describe, expect, it } from "vitest";
import {
  confirmationScheduleUtc,
  formatInSaoPaulo,
  computeOffsetTime,
} from "./lib/timezone";
import { renderMessageTemplate } from "./lib/template-renderer";

describe("timezone America/Sao_Paulo", () => {
  it("H-48 antes de consulta às 14:00 SP", () => {
    const appt = new Date("2026-07-15T17:00:00.000Z");
    const scheduled = confirmationScheduleUtc(appt, 48);
    expect(formatInSaoPaulo(scheduled, { hour: "2-digit", minute: "2-digit" })).toBe(
      "14:00",
    );
    expect(formatInSaoPaulo(scheduled, { day: "2-digit" })).toBe("13");
  });

  it("computeOffsetTime H-48", () => {
    const ref = new Date("2026-07-15T17:00:00.000Z");
    const result = computeOffsetTime(ref, -48, "HOURS");
    expect(result.getTime()).toBe(ref.getTime() - 48 * 3600_000);
  });
});

describe("template rendering", () => {
  it("substitui variáveis", () => {
    const out = renderMessageTemplate(
      "Olá {{paciente}}, {{data}} às {{hora}} — {{clinica}}",
      { paciente: "Ana", data: "15/07", hora: "14:00", clinica: "Vida Plena" },
    );
    expect(out).toContain("Ana");
    expect(out).toContain("Vida Plena");
    expect(out).not.toContain("{{");
  });
});
