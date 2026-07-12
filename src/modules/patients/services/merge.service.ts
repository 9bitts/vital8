import { encryptPHI } from "@/lib/crypto/phi";
import { hashCpf, normalizeSearchName } from "@/lib/crypto/search-hash";
import type { TenantClient } from "@/lib/db/tenant-client";
import type { MergePatientsInput } from "@/modules/patients/schemas/patient.schema";
import {
  decryptPatientRecord,
  type DecryptedPatient,
} from "@/modules/patients/services/patient.service";

function pickField(
  field: keyof MergePatientsInput["fieldChoices"],
  primary: DecryptedPatient,
  secondary: DecryptedPatient,
  choices: MergePatientsInput["fieldChoices"],
): string | Date | null {
  const source = choices[field] === "primary" ? primary : secondary;
  switch (field) {
    case "fullName":
      return source.fullName;
    case "socialName":
      return source.socialName;
    case "cpf":
      return source.cpf;
    case "birthDate":
      return source.birthDate;
    case "phone":
      return source.phones[0]?.number ?? null;
    case "email":
      return source.email;
    default:
      return null;
  }
}

export async function mergePatients(
  db: TenantClient,
  input: MergePatientsInput,
) {
  if (input.primaryPatientId === input.secondaryPatientId) {
    throw new Error("Não é possível mesclar o mesmo paciente");
  }

  const [primary, secondary] = await Promise.all([
    db.patient.findFirst({ where: { id: input.primaryPatientId } }),
    db.patient.findFirst({ where: { id: input.secondaryPatientId } }),
  ]);

  if (!primary || !secondary) {
    throw new Error("Paciente não encontrado");
  }

  const primaryDec = decryptPatientRecord(primary);
  const secondaryDec = decryptPatientRecord(secondary);
  const choices = input.fieldChoices;

  const mergedName = pickField("fullName", primaryDec, secondaryDec, choices) as string;
  const mergedSocial = pickField("socialName", primaryDec, secondaryDec, choices) as string | null;
  const mergedCpf = pickField("cpf", primaryDec, secondaryDec, choices) as string | null;
  const mergedBirth = pickField("birthDate", primaryDec, secondaryDec, choices) as Date | null;
  const mergedPhone = pickField("phone", primaryDec, secondaryDec, choices) as string | null;
  const mergedEmail = pickField("email", primaryDec, secondaryDec, choices) as string | null;

  const primaryPhones = primaryDec.phones;
  const secondaryPhones = secondaryDec.phones.filter(
    (p) => !primaryPhones.some((pp) => pp.number === p.number),
  );
  const mergedPhones =
    mergedPhone && !primaryPhones.some((p) => p.number === mergedPhone)
      ? [{ number: mergedPhone, label: "Principal" }, ...primaryPhones, ...secondaryPhones]
      : [...primaryPhones, ...secondaryPhones];

  await db.patient.update({
    where: { id: input.primaryPatientId },
    data: {
      searchName: normalizeSearchName(mergedName),
      fullName: mergedName,
      socialName: mergedSocial,
      cpfEncrypted: mergedCpf ? encryptPHI(mergedCpf) : primary.cpfEncrypted,
      cpfHash: mergedCpf ? hashCpf(mergedCpf, primary.organizationId) : primary.cpfHash,
      birthDate: mergedBirth ?? primary.birthDate,
      phonesEncrypted:
        mergedPhones.length > 0
          ? encryptPHI(JSON.stringify(mergedPhones))
          : primary.phonesEncrypted,
      phoneSearch: mergedPhone?.replace(/\D/g, "") ?? primary.phoneSearch,
      emailEncrypted: mergedEmail
        ? encryptPHI(mergedEmail)
        : primary.emailEncrypted,
      tags: Array.from(new Set([...primary.tags, ...secondary.tags])),
      isIncomplete: false,
    },
  });

  const relUpdates = [
    db.patientGuardian.updateMany({
      where: { patientId: input.secondaryPatientId },
      data: { patientId: input.primaryPatientId },
    }),
    db.patientInsurancePlan.updateMany({
      where: { patientId: input.secondaryPatientId },
      data: { patientId: input.primaryPatientId },
    }),
    db.patientConsent.updateMany({
      where: { patientId: input.secondaryPatientId },
      data: { patientId: input.primaryPatientId },
    }),
    db.patientDocument.updateMany({
      where: { patientId: input.secondaryPatientId },
      data: { patientId: input.primaryPatientId },
    }),
    db.allergy.updateMany({
      where: { patientId: input.secondaryPatientId },
      data: { patientId: input.primaryPatientId },
    }),
    db.chronicCondition.updateMany({
      where: { patientId: input.secondaryPatientId },
      data: { patientId: input.primaryPatientId },
    }),
    db.patientMedication.updateMany({
      where: { patientId: input.secondaryPatientId },
      data: { patientId: input.primaryPatientId },
    }),
  ];

  await Promise.all(relUpdates);

  await db.patient.update({
    where: { id: input.secondaryPatientId },
    data: {
      fullName: "Mesclado",
      searchName: "mesclado",
      isActive: false,
      deletedAt: new Date(),
      notesEncrypted: encryptPHI(
        `Mesclado em ${input.primaryPatientId} em ${new Date().toISOString()}`,
      ),
    },
  });

  return input.primaryPatientId;
}
