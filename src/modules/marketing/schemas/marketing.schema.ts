import { z } from "zod";

export const leadCreateSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  interestServiceId: z.string().optional(),
  leadSourceId: z.string().optional(),
  marketingCampaignId: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
  marketingConsent: z.boolean(),
  assignedUserId: z.string().optional(),
});

export const leadStatusSchema = z.object({
  leadId: z.string(),
  status: z.enum([
    "NOVO",
    "EM_CONTATO",
    "AGENDOU",
    "COMPARECEU",
    "CONVERTIDO",
    "PERDIDO",
  ]),
  lossReason: z.string().optional(),
});

export const leadInteractionSchema = z.object({
  leadId: z.string(),
  type: z.enum(["LIGACAO", "WHATSAPP", "EMAIL", "NOTA"]),
  notes: z.string().min(1),
});

export const publicLeadCaptureSchema = z.object({
  orgSlug: z.string(),
  landingSlug: z.string().optional(),
  fullName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  interest: z.string().optional(),
  marketingConsent: z.boolean().refine((v) => v === true, {
    message: "Consentimento de marketing obrigatório",
  }),
  privacyPolicyAccepted: z.boolean().refine((v) => v === true, {
    message: "Política de privacidade obrigatória",
  }),
  honeypot: z.string().max(0).optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
});

export const landingPageSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  title: z.string().min(2),
  metaDescription: z.string().optional(),
  blocks: z.array(z.record(z.string(), z.unknown())).default([]),
  theme: z.record(z.string(), z.unknown()).optional(),
});

export const marketingCampaignSchema = z.object({
  name: z.string().min(2),
  leadSourceId: z.string().optional(),
  channel: z.string().min(1),
  periodStart: z.string(),
  periodEnd: z.string(),
  investmentCents: z.number().int().min(0),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export type UtmParams = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
};
