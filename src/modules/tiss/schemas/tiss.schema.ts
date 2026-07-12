import { z } from "zod";

export const healthInsurerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  ansRegistration: z.string().min(1),
  cnpj: z.string().min(14).max(18),
  tissVersion: z.string().default("3.05.00"),
  providerCodeAtInsurer: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  paymentTermDays: z.coerce.number().int().min(1).default(30),
  batchClosingDay: z.coerce.number().int().min(1).max(28).default(25),
  requiresAuthorization: z.boolean().default(false),
  authProcedureTypes: z.array(z.string()).default([]),
  coparticipationPercent: z.coerce.number().int().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
});

export const insurerContractSchema = z.object({
  healthInsurerId: z.string(),
  priceTableId: z.string(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional().nullable(),
  adjustmentNotes: z.string().optional(),
});

export const priorAuthorizationSchema = z.object({
  id: z.string().optional(),
  healthInsurerId: z.string(),
  patientId: z.string(),
  serviceId: z.string().optional(),
  password: z.string().optional(),
  validUntil: z.coerce.date().optional(),
  authorizedQty: z.coerce.number().int().min(1).default(1),
  status: z.enum(["SOLICITADA", "AUTORIZADA", "NEGADA", "EXPIRADA"]).optional(),
  notes: z.string().optional(),
});

export const serviceTussMappingSchema = z.object({
  serviceId: z.string(),
  tussProcedureId: z.string(),
});

export const guideUpdateSchema = z.object({
  guideId: z.string(),
  consultationType: z
    .enum(["PRIMEIRA", "SEGUIMENTO", "PRE_NATAL", "REFERENCIADA"])
    .optional(),
  cid10Code: z.string().optional(),
  accidentIndication: z
    .enum(["NAO_ACIDENTE", "ACIDENTE_TRABALHO", "ACIDENTE_TRANSITO", "OUTROS_ACIDENTES"])
    .optional(),
  serviceCharacter: z.enum(["ELETIVO", "URGENCIA"]).optional(),
});

export const batchCreateSchema = z.object({
  healthInsurerId: z.string(),
  competence: z.string().regex(/^\d{4}-\d{2}$/),
  guideIds: z.array(z.string()).min(1),
});

export const batchReopenSchema = z.object({
  batchId: z.string(),
  reason: z.string().min(3),
});

export const insurerPaymentSchema = z.object({
  healthInsurerId: z.string(),
  tissBatchId: z.string(),
  paymentDate: z.coerce.date(),
  grossAmountCents: z.coerce.number().int().min(0),
  discountCents: z.coerce.number().int().min(0).default(0),
  netAmountCents: z.coerce.number().int().min(0),
  notes: z.string().optional(),
  guidePayments: z.array(
    z.object({
      guideId: z.string(),
      paidCents: z.coerce.number().int().min(0),
      glosedCents: z.coerce.number().int().min(0).default(0),
      glosaReasonCode: z.string().optional(),
    }),
  ),
});

export const glosaAppealSchema = z.object({
  glosaItemId: z.string(),
  justification: z.string().min(10),
  appealDeadline: z.coerce.date(),
});
