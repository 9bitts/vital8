import { describe, expect, it } from "vitest";
import {
  buildCarnêLeaoCsv,
  buildReceitaSaudeChecklist,
  buildReceitaSaudeReceipt,
  formatCpf,
} from "@/modules/finance/services/receita-saude.service";
import { resolveFiscalDocumentType } from "@/modules/finance/services/fiscal-settings.service";

describe("Receita Saúde", () => {
  it("builds receipt with patient CPF", () => {
    const receipt = buildReceitaSaudeReceipt({
      professionalName: "Dr. Ana",
      professionalDocument: "52998224725",
      councilType: "CRM",
      councilNumber: "12345",
      councilState: "SP",
      patientName: "João Silva",
      patientCpf: "11144477735",
      serviceDescription: "Consulta dermatológica",
      amountCents: 25000,
      paymentDate: new Date("2026-01-15"),
      organizationName: "Consultório Ana",
    });
    expect(receipt.number.startsWith("RS")).toBe(true);
    expect(Buffer.from(receipt.pdfBase64, "base64").toString()).toContain("529.982.247-25");
    expect(receipt.payload.tomador).toBeTruthy();
  });

  it("formats CPF", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });

  it("exports carnê-leão CSV", () => {
    const csv = buildCarnêLeaoCsv([
      {
        date: "2026-01-15",
        patientName: "João",
        patientCpf: "11144477735",
        serviceDescription: "Consulta",
        amountCents: 20000,
        professionalName: "Dr. Ana",
        documentNumber: "RS001",
      },
    ]);
    expect(csv).toContain("paciente_cpf");
    expect(csv).toContain("11144477735");
  });

  it("builds receita saude checklist", () => {
    const checklist = buildReceitaSaudeChecklist("pt");
    expect(checklist.length).toBeGreaterThan(3);
    expect(checklist[0]).toContain("pessoa física");
  });
});

describe("resolveFiscalDocumentType", () => {
  it("returns NFSE for CNPJ org in AUTO mode", () => {
    expect(
      resolveFiscalDocumentType("AUTO", "CNPJ", "CLINICA"),
    ).toBe("NFSE");
  });

  it("returns RECIBO for CPF org in AUTO mode", () => {
    expect(
      resolveFiscalDocumentType("AUTO", "CPF", "PROFISSIONAL_AUTONOMO"),
    ).toBe("RECIBO_RECEITA_SAUDE");
  });

  it("respects NFSE_ONLY profile", () => {
    expect(
      resolveFiscalDocumentType("NFSE_ONLY", "CPF", "PROFISSIONAL_AUTONOMO"),
    ).toBe("NFSE");
  });
});
