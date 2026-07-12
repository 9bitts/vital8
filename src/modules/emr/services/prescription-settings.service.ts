import { randomBytes } from "crypto";
import type { PrescriptionSettings } from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { decryptPHI, encryptPHI } from "@/lib/crypto/phi";
import { prescriptionSettingsSchema } from "../schemas/prescription.schema";

export async function getOrCreatePrescriptionSettings(
  db: TenantClient,
  organizationId: string,
): Promise<PrescriptionSettings> {
  const existing = await db.prescriptionSettings.findFirst({
    where: { organizationId },
  });
  if (existing) return existing;
  return db.prescriptionSettings.create({ data: { organizationId } });
}

export async function savePrescriptionSettings(
  db: TenantClient,
  organizationId: string,
  input: unknown,
): Promise<PrescriptionSettings> {
  const data = prescriptionSettingsSchema.parse(input);
  const payload: Record<string, unknown> = {
    provider: data.provider,
    memedPartnerId: data.memedPartnerId || null,
    blockOnAllergyConflict: data.blockOnAllergyConflict,
    blockOnDrugInteraction: data.blockOnDrugInteraction,
    autoSendToPatient: data.autoSendToPatient,
  };
  if (data.memedApiKey) {
    payload.memedApiKeyEncrypted = encryptPHI(data.memedApiKey);
  }

  return db.prescriptionSettings.upsert({
    where: { organizationId },
    create: { organizationId, ...payload },
    update: payload,
  });
}

export function decryptMemedApiKey(settings: PrescriptionSettings): string | null {
  return settings.memedApiKeyEncrypted
    ? decryptPHI(settings.memedApiKeyEncrypted)
    : null;
}

export function providerLabel(provider: PrescriptionSettings["provider"]): string {
  const labels: Record<PrescriptionSettings["provider"], string> = {
    LOCAL: "Catálogo local (DrugCatalog)",
    MEMED: "Memed (embed + webhook)",
  };
  return labels[provider];
}

export function maskPrescriptionSettings(settings: PrescriptionSettings) {
  return {
    ...settings,
    memedApiKeyEncrypted: settings.memedApiKeyEncrypted ? "[configurado]" : null,
  };
}

export function buildCfmValidationUrl(validationCode: string): string {
  const base =
    process.env.CFM_PRESCRIPTION_VALIDATION_URL ??
    "https://prescricaoeletronica.cfm.org.br/validar";
  return `${base}?codigo=${validationCode}`;
}

export function generatePrescriptionValidationCode(): string {
  return `RX${randomBytes(5).toString("hex").toUpperCase()}`;
}

export async function allocateControlBookNumber(
  db: TenantClient,
  organizationId: string,
  professionalId: string,
): Promise<string> {
  const seq = await db.prescriptionControlSequence.upsert({
    where: {
      organizationId_professionalId: { organizationId, professionalId },
    },
    create: { organizationId, professionalId, nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
  });
  const number = seq.nextNumber;
  const year = new Date().getFullYear();
  return `${year}-${String(number).padStart(6, "0")}`;
}
