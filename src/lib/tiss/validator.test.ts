import { describe, expect, it } from "vitest";
import { validateGuideFields, validateTissXmlStructure } from "./validator";
import { buildTissBatchXml } from "./xml-builder";
import { normalizeTissVersion } from "./version";

const samplePayload = {
  registroANS: "999999",
  numeroGuiaPrestador: "1",
  dadosBeneficiario: {
    numeroCarteira: "123",
    nomeBeneficiario: "João",
  },
  dadosContratadoExecutante: { cnpjContratado: "11222333000181", codigoCNES: "7654321" },
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
};

const batchBase = {
  ansRegistration: "999999",
  providerDocument: "11222333000181",
  providerCnes: "7654321",
  organizationName: "Clínica Teste",
  batchNumber: 1,
  competence: "2025-07",
  guides: [{ guideType: "GUIA_CONSULTA", payload: samplePayload }],
};

describe("validateGuideFields", () => {
  it("flags missing required fields for GUIA_CONSULTA", () => {
    const errors = validateGuideFields({
      guideType: "GUIA_CONSULTA",
      beneficiaryCard: "",
      beneficiaryName: "Maria",
      ansRegistration: "123456",
      providerDocument: "11222333000181",
      professionalName: "Dr.",
      professionalCouncilNumber: "CRM 12345",
      requiresAuthorization: false,
      procedures: [],
      consultationType: null,
    });
    expect(errors.some((e) => e.field === "beneficiaryCard")).toBe(true);
    expect(errors.some((e) => e.field === "consultationType")).toBe(true);
  });

  it("requires CNES for TISS 4.03", () => {
    const errors = validateGuideFields(
      {
        guideType: "GUIA_CONSULTA",
        beneficiaryCard: "123",
        beneficiaryName: "Maria",
        ansRegistration: "123456",
        providerDocument: "11222333000181",
        providerCnes: null,
        professionalName: "Dr.",
        professionalCouncilNumber: "CRM 12345",
        requiresAuthorization: false,
        procedures: [{ tussCode: "10101012", quantity: 1, unitValueCents: 10000 }],
        consultationType: "PRIMEIRA",
      },
      "4.03.00",
    );
    expect(errors.some((e) => e.field === "providerCnes")).toBe(true);
  });

  it("requires professional council number", () => {
    const errors = validateGuideFields({
      guideType: "GUIA_CONSULTA",
      beneficiaryCard: "123",
      beneficiaryName: "Maria",
      ansRegistration: "123456",
      providerDocument: "11222333000181",
      professionalName: "Dr.",
      professionalCouncilNumber: null,
      requiresAuthorization: false,
      procedures: [{ tussCode: "10101012", quantity: 1, unitValueCents: 10000 }],
      consultationType: "PRIMEIRA",
    });
    expect(errors.some((e) => e.field === "professionalCouncilNumber")).toBe(true);
  });
});

describe("TISS XML 3.05.00", () => {
  it("builds xml with valid structure and hash epilog", () => {
    const { xml, hash } = buildTissBatchXml({
      ...batchBase,
      tissVersion: "3.05.00",
    });

    expect(xml).toContain('versao="3.05.00"');
    expect(xml).toContain('xmlns="http://www.ans.gov.br/padroes/tiss/schemas"');
    expect(xml).toContain(`<hash>${hash}</hash>`);
    expect(xml).not.toContain("componenteOrganizacional");
    const structureErrors = validateTissXmlStructure(xml, "3.05.00");
    expect(structureErrors).toHaveLength(0);
  });
});

describe("TISS XML 4.03.00", () => {
  it("builds xml with componente organizacional e tabela TUSS 22", () => {
    const { xml, hash } = buildTissBatchXml({
      ...batchBase,
      tissVersion: "4.03.00",
    });

    expect(xml).toContain('versao="4.03.00"');
    expect(xml).toContain("<componenteOrganizacional>");
    expect(xml).toContain("<identificacaoSoftware>");
    expect(xml).toContain("<codigoTabela>22</codigoTabela>");
    expect(xml).toContain("<dadosExecutante>");
    expect(xml).toContain(`<hash>${hash}</hash>`);
    const structureErrors = validateTissXmlStructure(xml, "4.03.00");
    expect(structureErrors).toHaveLength(0);
  });

  it("normalizes 4.01 to 4.03 strategy", () => {
    expect(normalizeTissVersion("4.01.00")).toBe("4.03.00");
  });
});
