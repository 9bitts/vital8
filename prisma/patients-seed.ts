import { encryptPHI } from "../src/lib/crypto/phi";
import { hashCpf, normalizeSearchName } from "../src/lib/crypto/search-hash";
import type { PrismaClient } from "../src/generated/prisma/client";

type PatientSeed = {
  fullName: string;
  cpf?: string;
  phone?: string;
  email?: string;
  birthDate?: string;
  sex?: "MASCULINO" | "FEMININO";
  tags?: string[];
  isIncomplete?: boolean;
  isActive?: boolean;
  insurerName?: string;
  cardNumber?: string;
  allergy?: string;
  guardian?: { fullName: string; relationship: string; phone: string };
};

const VIDA_PLENA: PatientSeed[] = [
  { fullName: "Roberto Almeida", cpf: "52998224725", phone: "11987654321", birthDate: "1985-03-15", sex: "MASCULINO", tags: ["VIP"], insurerName: "Unimed", cardNumber: "123456789012345", allergy: "Dipirona" },
  { fullName: "Fernanda Costa", cpf: "39053344705", phone: "11976543210", birthDate: "1990-07-12", sex: "FEMININO", tags: ["Convênio"], insurerName: "Bradesco Saúde", cardNumber: "987654321000111" },
  { fullName: "Paciente Rápido", phone: "11999990099", isIncomplete: true },
  { fullName: "Lucas Mendes", cpf: "15350946056", phone: "11988887777", birthDate: "2015-04-20", sex: "MASCULINO", guardian: { fullName: "Maria Mendes", relationship: "Mãe", phone: "11988886666" } },
  { fullName: "Amanda Souza", cpf: "40377635039", phone: "11977776666", birthDate: "1988-11-03", sex: "FEMININO", tags: ["Particular"] },
  { fullName: "Paulo Ribeiro", cpf: "85889076792", phone: "11966665555", birthDate: "1975-01-28", sex: "MASCULINO", insurerName: "Amil", cardNumber: "555666777888999", allergy: "Penicilina" },
  { fullName: "Juliana Ferreira", cpf: "23100299900", phone: "11955554444", birthDate: "1992-09-08", sex: "FEMININO", insurerName: "SulAmérica", cardNumber: "111222333444555" },
  { fullName: "Marcos Oliveira", cpf: "87748272920", phone: "11944443333", birthDate: "1968-06-17", sex: "MASCULINO", isActive: false, tags: ["Inativo"] },
  { fullName: "Carla Dias", cpf: "71428793860", phone: "11933332222", birthDate: "1995-12-25", sex: "FEMININO", tags: ["Aniversariante"] },
  { fullName: "Henrique Lima", cpf: "45317828791", phone: "11922221111", birthDate: "2000-02-14", sex: "MASCULINO" },
];

const DR_TESTE: PatientSeed[] = [
  { fullName: "Elena Vasconcelos", cpf: "11144477735", phone: "21987654321", birthDate: "1983-08-22", sex: "FEMININO", insurerName: "Unimed", cardNumber: "444555666777888" },
  { fullName: "Ricardo Nunes", cpf: "52998224725", phone: "21976543210", birthDate: "1979-05-10", sex: "MASCULINO" },
  { fullName: "Beatriz Campos", phone: "21999998888", isIncomplete: true },
  { fullName: "Tiago Pires", cpf: "39053344705", phone: "21988887777", birthDate: "1991-03-30", sex: "MASCULINO", allergy: "Látex" },
  { fullName: "Sofia Martins", cpf: "15350946056", phone: "21977776666", birthDate: "2017-10-05", sex: "FEMININO", guardian: { fullName: "João Martins", relationship: "Pai", phone: "21977775555" } },
];

export async function seedPatients(
  prisma: PrismaClient,
  orgVidaPlenaId: string,
  orgDrTesteId: string,
) {
  async function create(orgId: string, item: PatientSeed) {
    const phones = item.phone
      ? [{ number: item.phone, label: "Principal" }]
      : [];

    const patient = await prisma.patient.create({
      data: {
        organizationId: orgId,
        searchName: normalizeSearchName(item.fullName),
        fullName: item.fullName,
        cpfEncrypted: item.cpf ? encryptPHI(item.cpf) : null,
        cpfHash: item.cpf ? hashCpf(item.cpf, orgId) : null,
        birthDate: item.birthDate ? new Date(item.birthDate) : null,
        sex: item.sex ?? null,
        phonesEncrypted: phones.length ? encryptPHI(JSON.stringify(phones)) : null,
        phoneSearch: item.phone?.replace(/\D/g, "") ?? null,
        emailEncrypted: item.email ? encryptPHI(item.email) : null,
        tags: item.tags ?? [],
        isIncomplete: item.isIncomplete ?? false,
        isActive: item.isActive ?? true,
      },
    });

    if (item.insurerName && item.cardNumber) {
      const normalized = item.cardNumber.replace(/\s/g, "");
      await prisma.patientInsurancePlan.create({
        data: {
          organizationId: orgId,
          patientId: patient.id,
          insurerName: item.insurerName,
          cardNumberEncrypted: encryptPHI(normalized),
          cardNumberSearch: normalized.replace(/\D/g, "").slice(-6),
          isPrimary: true,
        },
      });
    }

    if (item.allergy) {
      await prisma.allergy.create({
        data: {
          organizationId: orgId,
          patientId: patient.id,
          substance: item.allergy,
          severity: "Alta",
        },
      });
    }

    if (item.guardian) {
      await prisma.patientGuardian.create({
        data: {
          organizationId: orgId,
          patientId: patient.id,
          fullName: item.guardian.fullName,
          relationship: item.guardian.relationship,
          phoneEncrypted: encryptPHI(item.guardian.phone),
          isPrimary: true,
        },
      });
    }

    return patient;
  }

  for (const item of VIDA_PLENA) {
    await create(orgVidaPlenaId, item);
  }
  for (const item of DR_TESTE) {
    await create(orgDrTesteId, item);
  }

  console.log(`   → ${VIDA_PLENA.length + DR_TESTE.length} pacientes seed criados`);
}
