"use server";

import { revalidatePath } from "next/cache";
import {
  AuthError,
  getRequestMeta,
  requireAuth,
  type ActionResult,
} from "@/lib/auth/guards";
import { adminPrisma } from "@/lib/db/admin-client";
import { encryptPHI } from "@/lib/crypto/phi";
import { getPrescriptionProvider } from "@/lib/integrations/prescription-provider";
import {
  canSignEncounter,
  canViewAccessLog,
  canViewClinicalContent,
  isFinanceBlocked,
} from "@/modules/emr/lib/permissions";
import {
  amendmentSchema,
  certificateCreateSchema,
  drugSearchSchema,
  examRequestSchema,
  odontogramEntrySchema,
  prescriptionCreateSchema,
  sectionUpdateSchema,
  signEncounterSchema,
  startEncounterSchema,
  cid10SearchSchema,
  formTemplateSchema,
  examResultCreateSchema,
  bodyChartEntrySchema,
  formResponseSchema,
  repeatPrescriptionSchema,
} from "@/modules/emr/schemas/emr.schema";
import {
  addEncounterAmendment,
  createEncounterFromAppointment,
  getEncounterDetail,
  signEncounter,
  updateEncounterSection,
  listPatientEncounters,
  EncounterImmutableError,
} from "@/modules/emr/services/encounter.service";
import {
  createPrescription,
  getPrescription,
  repeatPrescription,
  listPatientPrescriptions,
} from "@/modules/emr/services/prescription.service";
import {
  generateCertificatePdf,
  generateExamRequestPdf,
  generatePrescriptionPdf,
  renderDocumentTemplate,
} from "@/modules/emr/services/pdf.service";
import { listPatientAccessLogs } from "@/modules/emr/services/record-access.service";
import {
  createExamResult,
} from "@/modules/emr/services/exam-result.service";

const CLINICAL_ROLES = [
  "OWNER",
  "ADMIN",
  "PROFISSIONAL_SAUDE",
] as const;

export async function startEncounterAction(
  input: unknown,
): Promise<ActionResult<{ encounterId: string }>> {
  try {
    const ctx = await requireAuth([...CLINICAL_ROLES]);
    if (isFinanceBlocked(ctx.role)) {
      throw new AuthError("Acesso negado", "FORBIDDEN");
    }
    const parsed = startEncounterSchema.parse(input);
    const encounter = await createEncounterFromAppointment(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      parsed.appointmentId,
      parsed.specialty,
    );
    revalidatePath("/app/recepcao");
    revalidatePath("/app/agenda");
    return { success: true, data: { encounterId: encounter.id } };
  } catch (e) {
    if (e instanceof AuthError) return { success: false, error: e.message };
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao iniciar atendimento" };
  }
}

export async function getEncounterAction(encounterId: string) {
  const ctx = await requireAuth([...CLINICAL_ROLES, "RECEPCAO", "LEITURA"]);
  if (isFinanceBlocked(ctx.role)) {
    throw new AuthError("Acesso negado", "FORBIDDEN");
  }
  const meta = await getRequestMeta();

  if (!canViewClinicalContent(ctx.role)) {
    const enc = await ctx.db.encounter.findFirstOrThrow({
      where: { id: encounterId },
      select: {
        id: true,
        startedAt: true,
        status: true,
        specialty: true,
        patientId: true,
      },
    });
    return { metadataOnly: true, encounter: enc };
  }

  return getEncounterDetail(
    ctx.db,
    ctx.organizationId,
    encounterId,
    ctx.userId,
    ctx.role,
    meta,
  );
}

export async function updateSectionAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...CLINICAL_ROLES]);
    const parsed = sectionUpdateSchema.parse(input);
    await updateEncounterSection(
      ctx.db,
      parsed.encounterId,
      parsed.sectionId,
      {
        content: parsed.content,
        structuredData: parsed.structuredData,
      },
    );
    revalidatePath(`/app/atendimento/${parsed.encounterId}`);
    return { success: true };
  } catch (e) {
    if (e instanceof EncounterImmutableError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao salvar seção" };
  }
}

export async function signEncounterAction(
  input: unknown,
): Promise<ActionResult<{ contentHash: string }>> {
  try {
    const ctx = await requireAuth([...CLINICAL_ROLES]);
    if (!canSignEncounter(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }
    const parsed = signEncounterSchema.parse(input);
    const result = await signEncounter(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      ctx.userName,
      parsed.encounterId,
    );
    revalidatePath(`/app/atendimento/${parsed.encounterId}`);
    revalidatePath("/app/recepcao");
    return { success: true, data: { contentHash: result.contentHash } };
  } catch (e) {
    if (e instanceof AuthError) return { success: false, error: e.message };
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao assinar" };
  }
}

export async function addAmendmentAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...CLINICAL_ROLES]);
    const parsed = amendmentSchema.parse(input);
    await addEncounterAmendment(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      parsed.encounterId,
      parsed.content,
    );
    revalidatePath(`/app/atendimento/${parsed.encounterId}`);
    return { success: true };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao adicionar adendo" };
  }
}

export async function createPrescriptionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth([...CLINICAL_ROLES]);
    const parsed = prescriptionCreateSchema.parse(input);
    const rx = await createPrescription(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      parsed,
    );
    revalidatePath(`/app/atendimento/${parsed.encounterId}`);
    return { success: true, data: { id: rx.id } };
  } catch (e) {
    if (e instanceof EncounterImmutableError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao prescrever" };
  }
}

export async function repeatPrescriptionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth([...CLINICAL_ROLES]);
    const parsed = repeatPrescriptionSchema.parse(input);
    const rx = await repeatPrescription(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      parsed.prescriptionId,
      parsed.encounterId,
    );
    if (parsed.encounterId) {
      revalidatePath(`/app/atendimento/${parsed.encounterId}`);
    }
    return { success: true, data: { id: rx.id } };
  } catch (e) {
    if (e instanceof EncounterImmutableError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao repetir receita" };
  }
}

export async function getPrescriptionPdfAction(
  prescriptionId: string,
): Promise<ActionResult<string>> {
  try {
    const ctx = await requireAuth([...CLINICAL_ROLES]);
    const meta = await getRequestMeta();
    const rx = await getPrescription(
      ctx.db,
      ctx.organizationId,
      prescriptionId,
      ctx.userId,
      meta,
    );

    const org = await adminPrisma.organization.findFirstOrThrow({
      where: { id: ctx.organizationId },
    });

    const pdf = generatePrescriptionPdf({
      header: {
        orgName: org.name,
        professionalName: rx.encounter.professional.displayName,
        council: rx.encounter.professional.councilType ?? undefined,
        councilNumber: rx.encounter.professional.councilNumber ?? undefined,
        councilState: rx.encounter.professional.councilState ?? undefined,
      },
      patientName:
        rx.encounter.patient.socialName ?? rx.encounter.patient.fullName,
      type: rx.type,
      items: rx.items,
      date: new Date(),
    });

    return { success: true, data: pdf.toString("base64") };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao gerar PDF" };
  }
}

export async function createCertificateAction(
  input: unknown,
): Promise<ActionResult<{ id: string; pdfBase64: string }>> {
  try {
    const ctx = await requireAuth([...CLINICAL_ROLES]);
    const parsed = certificateCreateSchema.parse(input);

    if (parsed.cidCode && !parsed.patientConsentRecorded) {
      return {
        success: false,
        error: "Consentimento do paciente obrigatório para incluir CID",
      };
    }

    const encounter = await ctx.db.encounter.findFirstOrThrow({
      where: { id: parsed.encounterId },
      include: { patient: true, professional: true },
    });

    let body = parsed.body;
    if (parsed.templateId) {
      const tmpl = await ctx.db.documentTemplate.findFirstOrThrow({
        where: { id: parsed.templateId },
      });
      body = renderDocumentTemplate(tmpl.bodyTemplate, {
        paciente: encounter.patient.socialName ?? encounter.patient.fullName,
        profissional: encounter.professional.displayName,
        data: new Date().toLocaleDateString("pt-BR"),
        cid: parsed.cidCode ?? "",
        dias: String(parsed.days ?? ""),
      });
    }

    const cert = await ctx.db.medicalCertificate.create({
      data: {
        organizationId: ctx.organizationId,
        encounterId: parsed.encounterId,
        patientId: encounter.patientId,
        authorUserId: ctx.userId,
        type: parsed.type,
        templateId: parsed.templateId ?? null,
        contentEncrypted: encryptPHI(body),
        cidCode: parsed.cidCode ?? null,
        patientConsentRecorded: parsed.patientConsentRecorded,
      },
    });

    const org = await adminPrisma.organization.findFirstOrThrow({
      where: { id: ctx.organizationId },
    });

    const pdf = generateCertificatePdf({
      header: {
        orgName: org.name,
        professionalName: encounter.professional.displayName,
        council: encounter.professional.councilType ?? undefined,
        councilNumber: encounter.professional.councilNumber ?? undefined,
        councilState: encounter.professional.councilState ?? undefined,
      },
      patientName: encounter.patient.socialName ?? encounter.patient.fullName,
      body,
      date: new Date(),
    });

    return {
      success: true,
      data: { id: cert.id, pdfBase64: pdf.toString("base64") },
    };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao emitir documento" };
  }
}

export async function createExamRequestAction(
  input: unknown,
): Promise<ActionResult<{ id: string; pdfBase64: string }>> {
  try {
    const ctx = await requireAuth([...CLINICAL_ROLES]);
    const parsed = examRequestSchema.parse(input);

    const encounter = await ctx.db.encounter.findFirstOrThrow({
      where: { id: parsed.encounterId },
      include: { patient: true, professional: true },
    });

    const request = await ctx.db.examRequest.create({
      data: {
        organizationId: ctx.organizationId,
        encounterId: parsed.encounterId,
        patientId: encounter.patientId,
        authorUserId: ctx.userId,
        notesEncrypted: parsed.notes ? encryptPHI(parsed.notes) : null,
        items: {
          create: parsed.exams.map((e) => ({
            organizationId: ctx.organizationId,
            examName: e.examName,
            instructions: e.instructions ?? null,
          })),
        },
      },
      include: { items: true },
    });

    const org = await adminPrisma.organization.findFirstOrThrow({
      where: { id: ctx.organizationId },
    });

    const pdf = generateExamRequestPdf({
      header: {
        orgName: org.name,
        professionalName: encounter.professional.displayName,
      },
      patientName: encounter.patient.socialName ?? encounter.patient.fullName,
      exams: request.items.map((i) => i.examName),
      notes: parsed.notes ?? undefined,
      date: new Date(),
    });

    return {
      success: true,
      data: { id: request.id, pdfBase64: pdf.toString("base64") },
    };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao solicitar exames" };
  }
}

export async function saveOdontogramEntryAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...CLINICAL_ROLES]);
    const parsed = odontogramEntrySchema.parse(input);

    let odontogram = await ctx.db.odontogram.findFirst({
      where: { encounterId: parsed.encounterId },
    });

    if (!odontogram) {
      odontogram = await ctx.db.odontogram.create({
        data: {
          organizationId: ctx.organizationId,
          encounterId: parsed.encounterId,
        },
      });
    }

    await ctx.db.odontogramEntry.create({
      data: {
        organizationId: ctx.organizationId,
        odontogramId: odontogram.id,
        toothFdi: parsed.toothFdi,
        face: parsed.face ?? null,
        finding: parsed.finding ?? null,
        procedure: parsed.procedure ?? null,
        status: parsed.status,
      },
    });

    revalidatePath(`/app/atendimento/${parsed.encounterId}`);
    return { success: true };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao salvar odontograma" };
  }
}

export async function searchCid10Action(input: unknown) {
  const ctx = await requireAuth([...CLINICAL_ROLES]);
  void ctx;
  const parsed = cid10SearchSchema.parse(input);
  return adminPrisma.cid10Code.findMany({
    where: {
      OR: [
        { code: { startsWith: parsed.query, mode: "insensitive" } },
        { description: { contains: parsed.query, mode: "insensitive" } },
      ],
    },
    take: 20,
  });
}

export async function searchDrugsAction(input: unknown) {
  await requireAuth([...CLINICAL_ROLES]);
  const parsed = drugSearchSchema.parse(input);
  return getPrescriptionProvider().searchDrugs(parsed.query);
}

export async function getPatientEmrHistoryAction(patientId: string) {
  const ctx = await requireAuth([...CLINICAL_ROLES, "RECEPCAO", "LEITURA"]);
  if (isFinanceBlocked(ctx.role)) {
    throw new AuthError("Acesso negado", "FORBIDDEN");
  }

  const [encounters, prescriptions] = await Promise.all([
    listPatientEncounters(ctx.db, patientId, ctx.role),
    canViewClinicalContent(ctx.role)
      ? listPatientPrescriptions(ctx.db, patientId)
      : [],
  ]);

  return { encounters, prescriptions };
}

export async function getPatientAccessLogsAction(patientId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  if (!canViewAccessLog(ctx.role)) {
    throw new AuthError("Permissão insuficiente", "FORBIDDEN");
  }
  return listPatientAccessLogs(ctx.organizationId, patientId);
}

export async function saveFormTemplateAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    const parsed = formTemplateSchema.parse(input);

    const template = await ctx.db.formTemplate.create({
      data: {
        organizationId: ctx.organizationId,
        name: parsed.name,
        specialty: parsed.specialty ?? null,
        versions: {
          create: {
            organizationId: ctx.organizationId,
            version: 1,
            schema: { fields: parsed.fields },
          },
        },
      },
    });

    revalidatePath("/app/configuracoes/prontuario");
    return { success: true, data: { id: template.id } };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao salvar formulário" };
  }
}

export async function listFormTemplatesAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"]);
  return ctx.db.formTemplate.findMany({
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });
}

export async function listDocumentTemplatesAction() {
  const ctx = await requireAuth([...CLINICAL_ROLES]);
  return ctx.db.documentTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function createExamResultAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth([...CLINICAL_ROLES]);
    const parsed = examResultCreateSchema.parse(input);
    const result = await createExamResult(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      parsed,
    );
    revalidatePath(`/app/atendimento/${parsed.encounterId}`);
    return { success: true, data: { id: result.id } };
  } catch (e) {
    if (e instanceof EncounterImmutableError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao registrar resultado" };
  }
}

export async function saveBodyChartEntryAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...CLINICAL_ROLES]);
    const parsed = bodyChartEntrySchema.parse(input);

    const encounter = await ctx.db.encounter.findFirstOrThrow({
      where: { id: parsed.encounterId },
    });
    if (encounter.status === "ASSINADO") {
      throw new EncounterImmutableError();
    }

    await ctx.db.bodyChartEntry.create({
      data: {
        organizationId: ctx.organizationId,
        encounterId: parsed.encounterId,
        x: parsed.x,
        y: parsed.y,
        label: parsed.label ?? null,
        noteEncrypted: parsed.note ? encryptPHI(parsed.note) : null,
      },
    });

    revalidatePath(`/app/atendimento/${parsed.encounterId}`);
    return { success: true };
  } catch (e) {
    if (e instanceof EncounterImmutableError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao salvar mapa corporal" };
  }
}

export async function saveFormResponseAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...CLINICAL_ROLES]);
    const parsed = formResponseSchema.parse(input);

    const encounter = await ctx.db.encounter.findFirstOrThrow({
      where: { id: parsed.encounterId },
    });
    if (encounter.status === "ASSINADO") {
      throw new EncounterImmutableError();
    }

    await ctx.db.formResponse.create({
      data: {
        organizationId: ctx.organizationId,
        encounterId: parsed.encounterId,
        versionId: parsed.versionId,
        answersEncrypted: encryptPHI(JSON.stringify(parsed.answers)),
      },
    });

    revalidatePath(`/app/atendimento/${parsed.encounterId}`);
    return { success: true };
  } catch (e) {
    if (e instanceof EncounterImmutableError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao salvar formulário" };
  }
}

export async function listActiveFormTemplatesForSpecialtyAction(
  specialty?: string | null,
) {
  const ctx = await requireAuth([...CLINICAL_ROLES]);
  return ctx.db.formTemplate.findMany({
    where: {
      isActive: true,
      OR: specialty
        ? [{ specialty }, { specialty: null }]
        : [{ specialty: null }],
    },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });
}
