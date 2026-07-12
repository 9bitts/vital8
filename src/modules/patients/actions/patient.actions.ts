"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import {
  AuthError,
  getRequestMeta,
  requireAuth,
  type ActionResult,
} from "@/lib/auth/guards";
import { encryptPHI } from "@/lib/crypto/phi";
import { hashCpf, normalizeSearchName } from "@/lib/crypto/search-hash";
import { getStorageAdapter } from "@/lib/integrations/storage";
import { createAuditLog } from "@/modules/core/services/audit.service";
import {
  allergySchema,
  chronicConditionSchema,
  csvImportSchema,
  medicationSchema,
  mergePatientsSchema,
  patientConsentSchema,
  patientContactSchema,
  patientGuardianSchema,
  patientInsuranceSchema,
  patientPersonalSchema,
  patientSearchSchema,
  quickPatientSchema,
} from "@/modules/patients/schemas/patient.schema";
import { mergePatients } from "@/modules/patients/services/merge.service";
import {
  anonymizePatient,
  buildLgpdExport,
  createFullPatient,
  createQuickPatient,
  decryptPatientRecord,
  encryptCardNumber,
  findDuplicateCandidates,
  getBirthdayPatients,
  getPatientById,
  searchPatients,
  updatePatientContact,
  updatePatientPersonal,
} from "@/modules/patients/services/patient.service";

const PATIENT_READ_ROLES = [
  "OWNER",
  "ADMIN",
  "PROFISSIONAL_SAUDE",
  "RECEPCAO",
  "FINANCEIRO",
  "LEITURA",
] as const;

const PATIENT_WRITE_ROLES = [
  "OWNER",
  "ADMIN",
  "PROFISSIONAL_SAUDE",
  "RECEPCAO",
] as const;

const PATIENT_ADMIN_ROLES = ["OWNER", "ADMIN"] as const;

async function auditPatient(
  action: string,
  ctx: Awaited<ReturnType<typeof requireAuth>>,
  patientId: string,
  metadata?: Prisma.InputJsonValue,
) {
  const meta = await getRequestMeta();
  await createAuditLog({
    action,
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    entityType: "Patient",
    entityId: patientId,
    metadata: metadata ?? {},
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export type PatientListItem = ReturnType<typeof decryptPatientRecord> & {
  primaryInsurance: { insurerName: string } | null;
};

export type PatientListResult = {
  items: PatientListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listPatientsAction(
  input: unknown,
): Promise<ActionResult<PatientListResult>> {
  try {
    const ctx = await requireAuth([...PATIENT_READ_ROLES]);
    const parsed = patientSearchSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Filtros inválidos" };
    }

    const result = await searchPatients(ctx.db, parsed.data);
    return {
      success: true,
      data: {
        ...result,
        items: result.items.map((p) => ({
          ...decryptPatientRecord(p),
          primaryInsurance: p.insurancePlans[0]
            ? { insurerName: p.insurancePlans[0].insurerName }
            : null,
        })),
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao listar pacientes" };
  }
}

export async function getPatientAction(patientId: string) {
  const ctx = await requireAuth([...PATIENT_READ_ROLES]);
  const patient = await getPatientById(ctx.db, patientId);
  if (!patient) return null;

  await auditPatient("patient.view", ctx, patientId);
  return buildLgpdExport(patient);
}

export async function createQuickPatientAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth([...PATIENT_WRITE_ROLES]);
    const parsed = quickPatientSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const patient = await createQuickPatient(ctx.db, ctx.organizationId, parsed.data);
    await auditPatient("patient.create.quick", ctx, patient.id);

    revalidatePath("/app/pacientes");
    return { success: true, data: { id: patient.id } };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao cadastrar paciente" };
  }
}

export async function createPatientAction(
  personalInput: unknown,
  contactInput?: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth([...PATIENT_WRITE_ROLES]);
    const personal = patientPersonalSchema.safeParse(personalInput);
    if (!personal.success) {
      return { success: false, error: personal.error.issues[0]?.message ?? "Dados pessoais inválidos" };
    }

    const contact = contactInput
      ? patientContactSchema.safeParse(contactInput)
      : null;
    if (contact && !contact.success) {
      return { success: false, error: contact.error.issues[0]?.message ?? "Contato inválido" };
    }

    if (personal.data.cpf) {
      const existing = await ctx.db.patient.findFirst({
        where: { cpfHash: hashCpf(personal.data.cpf) },
      });
      if (existing) {
        return { success: false, error: "CPF já cadastrado nesta organização" };
      }
    }

    const patient = await createFullPatient(
      ctx.db,
      ctx.organizationId,
      personal.data,
      contact?.data,
    );
    await auditPatient("patient.create", ctx, patient.id);

    revalidatePath("/app/pacientes");
    return { success: true, data: { id: patient.id } };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao cadastrar paciente" };
  }
}

export async function updatePatientPersonalAction(
  patientId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...PATIENT_WRITE_ROLES]);
    const parsed = patientPersonalSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    if (parsed.data.cpf) {
      const existing = await ctx.db.patient.findFirst({
        where: {
          cpfHash: hashCpf(parsed.data.cpf),
          id: { not: patientId },
        },
      });
      if (existing) {
        return { success: false, error: "CPF já cadastrado nesta organização" };
      }
    }

    await updatePatientPersonal(ctx.db, patientId, parsed.data);
    await auditPatient("patient.update.personal", ctx, patientId);

    revalidatePath(`/app/pacientes/${patientId}`);
    revalidatePath("/app/pacientes");
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao atualizar paciente" };
  }
}

export async function updatePatientContactAction(
  patientId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...PATIENT_WRITE_ROLES]);
    const parsed = patientContactSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Contato inválido" };
    }

    await updatePatientContact(ctx.db, patientId, parsed.data);
    await auditPatient("patient.update.contact", ctx, patientId);

    revalidatePath(`/app/pacientes/${patientId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao atualizar contato" };
  }
}

export async function upsertInsurancePlanAction(
  patientId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...PATIENT_WRITE_ROLES]);
    const parsed = patientInsuranceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Convênio inválido" };
    }

    const { encrypted, search } = encryptCardNumber(parsed.data.cardNumber);

    if (parsed.data.id) {
      await ctx.db.patientInsurancePlan.update({
        where: { id: parsed.data.id },
        data: {
          insurerName: parsed.data.insurerName,
          planName: parsed.data.planName || null,
          cardNumberEncrypted: encrypted,
          cardNumberSearch: search,
          validUntil: parsed.data.validUntil
            ? new Date(parsed.data.validUntil)
            : null,
          isPrimary: parsed.data.isPrimary,
        },
      });
    } else {
      if (parsed.data.isPrimary) {
        await ctx.db.patientInsurancePlan.updateMany({
          where: { patientId },
          data: { isPrimary: false },
        });
      }
      await ctx.db.patientInsurancePlan.create({
        data: {
          organizationId: ctx.organizationId,
          patientId,
          insurerName: parsed.data.insurerName,
          planName: parsed.data.planName || null,
          cardNumberEncrypted: encrypted,
          cardNumberSearch: search,
          validUntil: parsed.data.validUntil
            ? new Date(parsed.data.validUntil)
            : null,
          isPrimary: parsed.data.isPrimary,
        },
      });
    }

    await auditPatient("patient.insurance.upsert", ctx, patientId);
    revalidatePath(`/app/pacientes/${patientId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao salvar convênio" };
  }
}

export async function deleteInsurancePlanAction(
  patientId: string,
  planId: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...PATIENT_WRITE_ROLES]);
    await ctx.db.patientInsurancePlan.update({
      where: { id: planId },
      data: { deletedAt: new Date() },
    });
    await auditPatient("patient.insurance.delete", ctx, patientId, { planId });
    revalidatePath(`/app/pacientes/${patientId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao remover convênio" };
  }
}

export async function upsertGuardianAction(
  patientId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...PATIENT_WRITE_ROLES]);
    const parsed = patientGuardianSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Responsável inválido" };
    }

    const data = {
      fullName: parsed.data.fullName,
      cpfEncrypted: parsed.data.cpf ? encryptPHI(parsed.data.cpf) : null,
      phoneEncrypted: parsed.data.phone ? encryptPHI(parsed.data.phone) : null,
      relationship: parsed.data.relationship,
      isPrimary: parsed.data.isPrimary,
    };

    if (parsed.data.id) {
      await ctx.db.patientGuardian.update({
        where: { id: parsed.data.id },
        data,
      });
    } else {
      await ctx.db.patientGuardian.create({
        data: { organizationId: ctx.organizationId, patientId, ...data },
      });
    }

    await auditPatient("patient.guardian.upsert", ctx, patientId);
    revalidatePath(`/app/pacientes/${patientId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao salvar responsável" };
  }
}

export async function upsertAllergyAction(
  patientId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...PATIENT_WRITE_ROLES]);
    const parsed = allergySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Alergia inválida" };
    }

    const data = {
      substance: parsed.data.substance,
      severity: parsed.data.severity || null,
      notesEncrypted: parsed.data.notes ? encryptPHI(parsed.data.notes) : null,
    };

    if (parsed.data.id) {
      await ctx.db.allergy.update({ where: { id: parsed.data.id }, data });
    } else {
      await ctx.db.allergy.create({
        data: { organizationId: ctx.organizationId, patientId, ...data },
      });
    }

    revalidatePath(`/app/pacientes/${patientId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao salvar alergia" };
  }
}

export async function upsertChronicConditionAction(
  patientId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...PATIENT_WRITE_ROLES]);
    const parsed = chronicConditionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Condição inválida" };
    }

    const data = {
      condition: parsed.data.condition,
      cidCode: parsed.data.cidCode || null,
      diagnosedAt: parsed.data.diagnosedAt
        ? new Date(parsed.data.diagnosedAt)
        : null,
      notesEncrypted: parsed.data.notes ? encryptPHI(parsed.data.notes) : null,
    };

    if (parsed.data.id) {
      await ctx.db.chronicCondition.update({
        where: { id: parsed.data.id },
        data,
      });
    } else {
      await ctx.db.chronicCondition.create({
        data: { organizationId: ctx.organizationId, patientId, ...data },
      });
    }

    revalidatePath(`/app/pacientes/${patientId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao salvar condição" };
  }
}

export async function upsertMedicationAction(
  patientId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...PATIENT_WRITE_ROLES]);
    const parsed = medicationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Medicamento inválido" };
    }

    const data = {
      name: parsed.data.name,
      dosage: parsed.data.dosage || null,
      frequency: parsed.data.frequency || null,
      route: parsed.data.route || null,
      isActive: parsed.data.isActive,
      notesEncrypted: parsed.data.notes ? encryptPHI(parsed.data.notes) : null,
    };

    if (parsed.data.id) {
      await ctx.db.patientMedication.update({
        where: { id: parsed.data.id },
        data,
      });
    } else {
      await ctx.db.patientMedication.create({
        data: { organizationId: ctx.organizationId, patientId, ...data },
      });
    }

    revalidatePath(`/app/pacientes/${patientId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao salvar medicamento" };
  }
}

export async function recordConsentAction(
  patientId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...PATIENT_WRITE_ROLES]);
    const parsed = patientConsentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Consentimento inválido" };
    }

    await ctx.db.patientConsent.create({
      data: {
        organizationId: ctx.organizationId,
        patientId,
        termKey: parsed.data.termKey,
        termVersion: parsed.data.termVersion,
        purpose: parsed.data.purpose,
        channel: parsed.data.channel,
        recordedById: ctx.userId,
      },
    });

    await auditPatient("patient.consent.record", ctx, patientId, parsed.data);
    revalidatePath(`/app/pacientes/${patientId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao registrar consentimento" };
  }
}

export async function uploadPatientDocumentAction(
  patientId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth([...PATIENT_WRITE_ROLES]);
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "OUTRO";

    if (!file || file.size === 0) {
      return { success: false, error: "Arquivo não enviado" };
    }

    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: "Arquivo excede 10 MB" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorageAdapter();
    const stored = await storage.upload(
      ctx.organizationId,
      patientId,
      file.name,
      file.type || "application/octet-stream",
      buffer,
    );

    const doc = await ctx.db.patientDocument.create({
      data: {
        organizationId: ctx.organizationId,
        patientId,
        category: category as "OUTRO",
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
        storageKey: stored.storageKey,
        uploadedById: ctx.userId,
      },
    });

    await auditPatient("patient.document.upload", ctx, patientId, {
      documentId: doc.id,
      fileName: doc.fileName,
    });

    revalidatePath(`/app/pacientes/${patientId}`);
    return { success: true, data: { id: doc.id } };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao enviar documento" };
  }
}

export async function listDuplicatesAction() {
  const ctx = await requireAuth([...PATIENT_ADMIN_ROLES]);
  const groups = await findDuplicateCandidates(ctx.db);
  return groups.map((g) => ({
    reason: g.reason,
    patients: g.patients.map(decryptPatientRecord),
  }));
}

export async function mergePatientsAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth([...PATIENT_ADMIN_ROLES]);
    const parsed = mergePatientsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const mergedId = await mergePatients(ctx.db, parsed.data);
    await auditPatient("patient.merge", ctx, mergedId, {
      secondaryId: parsed.data.secondaryPatientId,
    });

    revalidatePath("/app/pacientes");
    revalidatePath("/app/pacientes/duplicados");
    return { success: true, data: { id: mergedId } };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao mesclar pacientes",
    };
  }
}

export async function exportLgpdAction(
  patientId: string,
): Promise<ActionResult<string>> {
  try {
    const ctx = await requireAuth([...PATIENT_ADMIN_ROLES]);
    const patient = await getPatientById(ctx.db, patientId);
    if (!patient) {
      return { success: false, error: "Paciente não encontrado" };
    }

    const exportData = buildLgpdExport(patient);
    await auditPatient("patient.export.lgpd", ctx, patientId);

    return { success: true, data: JSON.stringify(exportData, null, 2) };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao exportar dados" };
  }
}

export async function anonymizePatientAction(
  patientId: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...PATIENT_ADMIN_ROLES]);
    await anonymizePatient(ctx.db, patientId);
    await auditPatient("patient.anonymize", ctx, patientId);

    revalidatePath("/app/pacientes");
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao anonimizar paciente" };
  }
}

export async function importPatientsCsvAction(
  input: unknown,
): Promise<
  ActionResult<{ imported: number; skipped: number; errors: string[] }>
> {
  try {
    const ctx = await requireAuth([...PATIENT_ADMIN_ROLES]);
    const parsed = csvImportSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "CSV inválido" };
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let index = 0; index < parsed.data.rows.length; index++) {
      const row = parsed.data.rows[index]!;
      try {
        if (row.cpf) {
          const hash = hashCpf(row.cpf);
          const existing = await ctx.db.patient.findFirst({
            where: { cpfHash: hash },
          });
          if (existing) {
            if (parsed.data.skipDuplicates) {
              skipped++;
              continue;
            }
            errors.push(`Linha ${index + 1}: CPF duplicado`);
            continue;
          }
        }

        const phones = row.phone ? [{ number: row.phone, label: "Importado" }] : [];
        await ctx.db.patient.create({
          data: {
            organizationId: ctx.organizationId,
            searchName: normalizeSearchName(row.fullName),
            fullName: row.fullName.trim(),
            cpfEncrypted: row.cpf ? encryptPHI(row.cpf.replace(/\D/g, "")) : null,
            cpfHash: row.cpf ? hashCpf(row.cpf) : null,
            phonesEncrypted: phones.length
              ? encryptPHI(JSON.stringify(phones))
              : null,
            phoneSearch: row.phone?.replace(/\D/g, "") || null,
            emailEncrypted: row.email ? encryptPHI(row.email) : null,
            birthDate: row.birthDate ? new Date(row.birthDate) : null,
            tags: row.tags
              ? row.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
              : [],
            isIncomplete: !row.cpf,
          },
        });

        if (row.insurerName && row.cardNumber) {
          const patient = await ctx.db.patient.findFirst({
            where: { fullName: row.fullName.trim() },
            orderBy: { createdAt: "desc" },
          });
          if (patient) {
            const { encrypted, search } = encryptCardNumber(row.cardNumber);
            await ctx.db.patientInsurancePlan.create({
              data: {
                organizationId: ctx.organizationId,
                patientId: patient.id,
                insurerName: row.insurerName,
                cardNumberEncrypted: encrypted,
                cardNumberSearch: search,
                isPrimary: true,
              },
            });
          }
        }

        imported++;
      } catch (err) {
        errors.push(
          `Linha ${index + 1}: ${err instanceof Error ? err.message : "Erro desconhecido"}`,
        );
      }
    }

    await createAuditLog({
      action: "patient.import.csv",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      metadata: { imported, skipped, errorCount: errors.length },
    });

    revalidatePath("/app/pacientes");
    return { success: true, data: { imported, skipped, errors } };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro na importação" };
  }
}

export async function listBirthdaysAction(range: "today" | "week" = "today") {
  const ctx = await requireAuth([...PATIENT_READ_ROLES]);
  const patients = await getBirthdayPatients(ctx.db, range);
  return patients.map(decryptPatientRecord);
}

export async function getPatientTagsAction(): Promise<string[]> {
  const ctx = await requireAuth([...PATIENT_READ_ROLES]);
  const patients = await ctx.db.patient.findMany({
    select: { tags: true },
  });
  const tagSet = new Set<string>();
  for (const p of patients) {
    for (const tag of p.tags) tagSet.add(tag);
  }
  return Array.from(tagSet).sort();
}

export async function getPatientInsurersAction(): Promise<string[]> {
  const ctx = await requireAuth([...PATIENT_READ_ROLES]);
  const plans = await ctx.db.patientInsurancePlan.findMany({
    select: { insurerName: true },
    distinct: ["insurerName"],
  });
  return plans.map((p) => p.insurerName).sort();
}
