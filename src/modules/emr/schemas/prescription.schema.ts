import { z } from "zod";

export const prescriptionSettingsSchema = z.object({
  provider: z.enum(["LOCAL", "MEMED"]).default("LOCAL"),
  memedPartnerId: z.string().optional().nullable(),
  memedApiKey: z.string().optional().nullable(),
  blockOnAllergyConflict: z.boolean().default(true),
  blockOnDrugInteraction: z.boolean().default(false),
  autoSendToPatient: z.boolean().default(false),
});

export const prescriptionCreateSchema = z.object({
  encounterId: z.string(),
  type: z.enum(["COMUM", "CONTROLE_ESPECIAL"]).default("COMUM"),
  notes: z.string().optional().nullable(),
  items: z.array(
    z.object({
      drugCatalogId: z.string().optional().nullable(),
      drugName: z.string().min(1),
      concentration: z.string().optional().nullable(),
      pharmaceuticalForm: z.string().optional().nullable(),
      dosage: z.string().min(1),
      route: z.string().optional().nullable(),
      duration: z.string().optional().nullable(),
      quantity: z.string().optional().nullable(),
    }),
  ).min(1),
  confirmSafetyOverride: z.boolean().default(false),
});
