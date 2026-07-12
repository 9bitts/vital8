import { describe, expect, it } from "vitest";
import { validateGuideFields, validateTissXmlStructure } from "./validator";
import { buildTissBatchXml } from "./xml-builder";

describe("validateGuideFields", () => {
  it("flags missing required fields for GUIA_CONSULTA", () => {
    const errors = validateGuideFields({
      guideType: "GUIA_CONSULTA",
      beneficiaryCard: "",
      beneficiaryName: "Maria",
      ansRegistration: "123456",
      providerDocument: "11222333000181",
      professionalName: "Dr.",
      requiresAuthorization: false,
      procedures: [],
      consultationType: null,
    });
    expect(errors.some((e) => e.field === "beneficiaryCard")).toBe(true);
    expect(errors.some((e) => e.field === "consultationType")).toBe(true);
  });

  it("requires authorization when configured", () => {
    const errors = validateGuideFields({
      guideType: "GUIA_CONSULTA",
      beneficiaryCard: "123",
      beneficiaryName: "Maria",
      ansRegistration: "123456",
      providerDocument: "11222333000181",
      professionalName: "Dr.",
      requiresAuthorization: true,
      authorizationValid: false,
      procedures: [{ tussCode: "10101012", quantity: 1, unitValueCents: 10000 }],
      consultationType: "PRIMEIRA",
    });
    expect(errors.some((e) => e.field === "priorAuthorization")).toBe(true);
  });
});

describe("TISS XML", () => {
  it("builds xml with valid structure and hash epilog", () => {
    const { xml, hash } = buildTissBatchXml({
      tissVersion: "3.05.00",
      ansRegistration: "999999",
      providerDocument: "11222333000181",
      batchNumber: 1,
      competence: "2025-07",
      guides: [
        {
          guideType: "GUIA_CONSULTA",
          payload: {
            registroANS: "999999",
            numeroGuiaPrestador: "1",
            dadosBeneficiario: {
              numeroCarteira: "123",
              nomeBeneficiario: "João",
            },
            dadosContratadoExecutante: { cnpjContratado: "11222333000181" },
            profissionalExecutante: { nomeProfissional: "Dr. Ana" },
            indicacaoAcidente: "0",
            caraterAtendimento: "1",
            tipoConsulta: "1",
            procedimentos: [
              {
                tussCode: "10101012",
                term: "Consulta",
                quantity: 1,
                unitValueCents: 15000,
                totalValueCents: 15000,
                executionDate: "2025-07-01",
              },
            ],
            dataAtendimento: "2025-07-01",
            horaAtendimento: "10:00:00",
          },
        },
      ],
    });

    expect(xml).toContain('xmlns="http://www.ans.gov.br/padroes/tiss/schemas"');
    expect(xml).toContain(`<hash>${hash}</hash>`);
    const structureErrors = validateTissXmlStructure(xml);
    expect(structureErrors).toHaveLength(0);
  });
});
