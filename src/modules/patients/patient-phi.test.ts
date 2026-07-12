import { describe, it, expect } from "vitest";
import { encryptPHI } from "@/lib/crypto/phi";
import { decryptPatientRecord, buildLgpdExport } from "@/modules/patients/services/patient.service";
import type { Patient } from "@/generated/prisma/client";

describe("Patient PHI encryption", () => {
  it("criptografa e descriptografa campos do paciente", () => {
    const cpf = encryptPHI("52998224725");
    const phones = encryptPHI(
      JSON.stringify([{ number: "11999998888", label: "Celular" }]),
    );
    const address = encryptPHI(
      JSON.stringify({ cep: "01310100", city: "São Paulo", state: "SP" }),
    );

    const patient = {
      id: "p1",
      organizationId: "org1",
      searchName: "joao silva",
      fullName: "João Silva",
      socialName: null,
      cpfEncrypted: cpf,
      cpfHash: "abc",
      cnsEncrypted: null,
      rgEncrypted: encryptPHI("1234567"),
      birthDate: new Date("1990-01-01"),
      sex: "MASCULINO" as const,
      genderIdentity: null,
      maritalStatus: null,
      profession: null,
      phonesEncrypted: phones,
      phoneSearch: "11999998888",
      emailEncrypted: encryptPHI("joao@test.local"),
      addressEncrypted: address,
      photoUrl: null,
      notesEncrypted: encryptPHI("Observação clínica"),
      referralSource: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      leadSourceId: null,
      marketingCampaignId: null,
      acquiredAt: null,
      tags: [],
      isIncomplete: false,
      isActive: true,
      anonymizedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } satisfies Patient;

    const decrypted = decryptPatientRecord(patient);
    expect(decrypted.cpf).toBe("52998224725");
    expect(decrypted.phones[0]?.number).toBe("11999998888");
    expect(decrypted.email).toBe("joao@test.local");
    expect(decrypted.address?.city).toBe("São Paulo");
    expect(decrypted.notes).toBe("Observação clínica");
  });

  it("export LGPD redige terceiros em notas", () => {
    const patient = {
      id: "p1",
      organizationId: "org1",
      searchName: "joao",
      fullName: "João",
      socialName: null,
      cpfEncrypted: encryptPHI("52998224725"),
      cpfHash: "abc",
      cnsEncrypted: null,
      rgEncrypted: null,
      birthDate: null,
      sex: null,
      genderIdentity: null,
      maritalStatus: null,
      profession: null,
      phonesEncrypted: null,
      phoneSearch: null,
      emailEncrypted: null,
      addressEncrypted: null,
      photoUrl: null,
      notesEncrypted: encryptPHI("Encaminhado ao Dr. Carlos Silva — CPF 123.456.789-00"),
      referralSource: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      tags: [],
      isIncomplete: false,
      isActive: true,
      anonymizedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      guardians: [],
      insurancePlans: [],
      consents: [],
      documents: [],
      allergies: [],
      chronicConditions: [],
      medications: [],
    } as unknown as Parameters<typeof buildLgpdExport>[0];

    const exported = buildLgpdExport(patient);
    expect(exported.patient.notes).not.toMatch(/Carlos Silva/);
    expect(exported.patient.notes).toMatch(/TERCEIRO REDACTED/);
    expect(exported.patient.notes).not.toMatch(/123\.456\.789/);
  });
});
