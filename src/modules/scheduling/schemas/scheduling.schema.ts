import { z } from "zod";

export const professionalSchema = z.object({
  id: z.string().optional(),
  displayName: z.string().min(2, "Nome obrigatório"),
  userId: z.string().optional().nullable(),
  councilType: z
    .enum(["CRM", "CRO", "CREFITO", "CRP", "CRN", "OUTRO"])
    .optional()
    .nullable(),
  councilNumber: z.string().optional().nullable(),
  councilState: z.string().max(2).optional().nullable(),
  specialties: z.array(z.string()).default([]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#3B82F6"),
  isActive: z.boolean().default(true),
});

export const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  category: z.string().optional().nullable(),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  privatePrice: z.coerce.number().min(0),
  tussCode: z.string().optional().nullable(),
  preparationInstructions: z.string().optional().nullable(),
  allowOnlineBooking: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const roomSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  isActive: z.boolean().default(true),
});

export const scheduleTemplateSchema = z.object({
  id: z.string().optional(),
  professionalId: z.string(),
  weekday: z.enum([
    "DOMINGO",
    "SEGUNDA",
    "TERCA",
    "QUARTA",
    "QUINTA",
    "SEXTA",
    "SABADO",
  ]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotIntervalMinutes: z.coerce.number().int().min(5).max(120).default(30),
  defaultRoomId: z.string().optional().nullable(),
});

export const scheduleExceptionSchema = z.object({
  professionalId: z.string(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  reason: z.string().optional().nullable(),
});

export const holidaySchema = z.object({
  date: z.coerce.date(),
  name: z.string().min(2),
});

export const appointmentCreateSchema = z.object({
  patientId: z.string(),
  professionalId: z.string(),
  serviceId: z.string(),
  roomId: z.string().optional().nullable(),
  branchId: z.string().cuid().optional().nullable(),
  startsAt: z.coerce.date(),
  origin: z.enum(["RECEPCAO", "TELEFONE", "ONLINE"]).default("RECEPCAO"),
  isPrivate: z.boolean().default(true),
  patientInsurancePlanId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isSqueeze: z.boolean().default(false),
  sendConfirmation: z.boolean().default(true),
  confirmationChannel: z.enum(["WHATSAPP", "SMS", "EMAIL"]).default("WHATSAPP"),
});

export const appointmentRescheduleSchema = z.object({
  appointmentId: z.string(),
  startsAt: z.coerce.date(),
  professionalId: z.string().optional(),
  roomId: z.string().optional().nullable(),
});

export const appointmentStatusSchema = z.object({
  appointmentId: z.string(),
  status: z.enum([
    "AGENDADO",
    "CONFIRMADO",
    "AGUARDANDO",
    "EM_ATENDIMENTO",
    "FINALIZADO",
    "FALTOU",
    "CANCELADO",
    "REMARCADO",
  ]),
  cancelReason: z.string().optional().nullable(),
});

export const recurrenceCreateSchema = appointmentCreateSchema.extend({
  sessionCount: z.coerce.number().int().min(2).max(52),
  frequency: z.enum(["WEEKLY", "BIWEEKLY"]),
  conflictStrategy: z.enum(["skip", "squeeze", "fail"]).default("skip"),
});

export const waitingListSchema = z.object({
  patientId: z.string(),
  serviceId: z.string(),
  preferredProfessionalId: z.string().optional().nullable(),
  preferredPeriodStart: z.coerce.date().optional().nullable(),
  preferredPeriodEnd: z.coerce.date().optional().nullable(),
  priority: z.coerce.number().int().default(0),
  notes: z.string().optional().nullable(),
});

export const schedulingSettingsSchema = z.object({
  receptionWaitLimitMinutes: z.coerce.number().int().min(5).max(240).default(30),
  professionalCanViewOthers: z.boolean().default(true),
});

export const agendaFilterSchema = z.object({
  view: z.enum(["day", "week", "month"]).default("day"),
  date: z.coerce.date(),
  professionalIds: z.array(z.string()).optional(),
  roomIds: z.array(z.string()).optional(),
  serviceIds: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
});
