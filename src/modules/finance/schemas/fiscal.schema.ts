import { z } from "zod";

export const fiscalSettingsSchema = z.object({
  taxRegime: z.enum(["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MEI"]),
  cnae: z.string().optional().nullable(),
  nacionalServiceCode: z.string().optional().nullable(),
  issRateBasisPoints: z.number().int().min(0).max(10000).default(500),
  nfseProvider: z.enum(["MOCK", "NFSE_NACIONAL"]).default("MOCK"),
  autoEmitOnPayment: z.boolean().default(false),
  emitProfile: z.enum(["AUTO", "NFSE_ONLY", "RECEITA_SAUDE_ONLY"]).default("AUTO"),
  municipioIbgeCode: z.string().optional().nullable(),
  inscricaoMunicipal: z.string().optional().nullable(),
  cbsIbsEnabled: z.boolean().default(false),
  cbsRateBasisPoints: z.number().int().min(0).max(10000).optional().nullable(),
  ibsRateBasisPoints: z.number().int().min(0).max(10000).optional().nullable(),
  certificateBase64: z.string().optional().nullable(),
  certificatePassword: z.string().optional().nullable(),
});

export const manualEmitSchema = z.object({
  paymentId: z.string().min(1),
});

export const carnêLeaoReportSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  professionalId: z.string().optional().nullable(),
});
