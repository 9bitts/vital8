import { z } from "zod";

export const sectionUpdateSchema = z.object({
  encounterId: z.string(),
  sectionId: z.string(),
  content: z.string().optional().nullable(),
  structuredData: z.record(z.string(), z.unknown()).optional(),
});

export const signEncounterSchema = z.object({
  encounterId: z.string(),
});

export const amendmentSchema = z.object({
  encounterId: z.string(),
  content: z.string().min(1),
});

export const prescriptionItemSchema = z.object({
  drugCatalogId: z.string().optional().nullable(),
  drugName: z.string().min(1),
  concentration: z.string().optional().nullable(),
  pharmaceuticalForm: z.string().optional().nullable(),
  dosage: z.string().min(1),
  route: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  quantity: z.string().optional().nullable(),
});

export const prescriptionCreateSchema = z.object({
  encounterId: z.string(),
  type: z.enum(["COMUM", "CONTROLE_ESPECIAL"]).default("COMUM"),
  notes: z.string().optional().nullable(),
  items: z.array(prescriptionItemSchema).min(1),
  confirmSafetyOverride: z.boolean().default(false),
});

export const certificateCreateSchema = z.object({
  encounterId: z.string(),
  type: z.enum(["ATESTADO", "DECLARACAO", "COMPARECIMENTO"]),
  templateId: z.string().optional().nullable(),
  body: z.string().min(1),
  cidCode: z.string().optional().nullable(),
  patientConsentRecorded: z.boolean().default(false),
  days: z.coerce.number().optional(),
});

export const examRequestSchema = z.object({
  encounterId: z.string(),
  exams: z.array(z.object({
    examName: z.string().min(1),
    instructions: z.string().optional().nullable(),
  })).min(1),
  notes: z.string().optional().nullable(),
});

export const odontogramEntrySchema = z.object({
  encounterId: z.string(),
  toothFdi: z.coerce.number().int().min(11).max(48),
  face: z.string().optional().nullable(),
  finding: z.string().optional().nullable(),
  procedure: z.string().optional().nullable(),
  status: z.enum(["PLANEJADO", "REALIZADO", "EXISTENTE"]).default("PLANEJADO"),
});

export const formTemplateSchema = z.object({
  name: z.string().min(2),
  specialty: z.string().optional().nullable(),
  fields: z.array(z.object({
    id: z.string(),
    type: z.enum(["TEXT", "NUMBER", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SCALE", "DATE", "TABLE"]),
    label: z.string(),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(),
  })),
});

export const startEncounterSchema = z.object({
  appointmentId: z.string(),
  specialty: z.string().optional(),
});

export const cid10SearchSchema = z.object({
  query: z.string().min(2),
});

export const drugSearchSchema = z.object({
  query: z.string().min(2),
});

export const examResultCreateSchema = z.object({
  encounterId: z.string(),
  requestId: z.string().optional().nullable(),
  fileName: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  fileBase64: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  values: z
    .array(
      z.object({
        name: z.string().min(1),
        value: z.string().min(1),
        unit: z.string().optional().nullable(),
        referenceRange: z.string().optional().nullable(),
      }),
    )
    .optional(),
});

export const bodyChartEntrySchema = z.object({
  encounterId: z.string(),
  x: z.coerce.number().min(0).max(100),
  y: z.coerce.number().min(0).max(100),
  label: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const formResponseSchema = z.object({
  encounterId: z.string(),
  versionId: z.string(),
  answers: z.record(z.string(), z.unknown()),
});

export const repeatPrescriptionSchema = z.object({
  prescriptionId: z.string(),
  encounterId: z.string().optional(),
});
