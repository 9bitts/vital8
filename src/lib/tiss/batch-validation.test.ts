import { describe, expect, it } from "vitest";
import { validateTissBatch } from "./batch-validation";

describe("validateTissBatch", () => {
  const baseGuide = {
    guideNumber: 1,
    guideType: "GUIA_CONSULTA",
    beneficiaryName: "Maria Silva",
    beneficiaryCard: "123456",
    professionalName: "Dr. João",
    professionalCouncilNumber: "CRM 12345",
    procedures: [{ tussCode: "10101012", quantity: 1, unitValueCents: 15000 }],
    totalValueCents: 15000,
  };

  it("accepts valid batch for 4.03", () => {
    const errors = validateTissBatch({
      batchNumber: 1,
      competence: "2026-07",
      ansRegistration: "999999",
      providerDocument: "11222333000181",
      organizationName: "Clínica Teste",
      providerCnes: "7654321",
      tissVersion: "4.03.00",
      guides: [baseGuide],
    });
    expect(errors).toHaveLength(0);
  });

  it("requires CNES for 4.03", () => {
    const errors = validateTissBatch({
      batchNumber: 1,
      competence: "2026-07",
      ansRegistration: "999999",
      providerDocument: "11222333000181",
      organizationName: "Clínica Teste",
      providerCnes: null,
      tissVersion: "4.03.00",
      guides: [baseGuide],
    });
    expect(errors.some((e) => e.field === "providerCnes")).toBe(true);
  });

  it("requires council number on guide", () => {
    const errors = validateTissBatch({
      batchNumber: 1,
      competence: "2026-07",
      ansRegistration: "999999",
      providerDocument: "11222333000181",
      organizationName: "Clínica Teste",
      providerCnes: "7654321",
      tissVersion: "4.03.00",
      guides: [{ ...baseGuide, professionalCouncilNumber: null }],
    });
    expect(errors.some((e) => e.field === "guides[0].professionalCouncilNumber")).toBe(true);
  });

  it("rejects empty batch", () => {
    const errors = validateTissBatch({
      batchNumber: 1,
      competence: "2026-07",
      ansRegistration: "999999",
      providerDocument: "11222333000181",
      organizationName: "Clínica Teste",
      providerCnes: "7654321",
      tissVersion: "4.03.00",
      guides: [],
    });
    expect(errors.some((e) => e.field === "guides")).toBe(true);
  });
});
