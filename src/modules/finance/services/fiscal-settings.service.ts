import type {
  DocumentType,
  FiscalEmitProfile,
  FiscalSettings,
  OrganizationType,
} from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { decryptPHI, encryptPHI } from "@/lib/crypto/phi";
import { fiscalSettingsSchema } from "../schemas/fiscal.schema";

export type FiscalSettingsInput = ReturnType<typeof fiscalSettingsSchema.parse>;

export async function getOrCreateFiscalSettings(
  db: TenantClient,
  organizationId: string,
): Promise<FiscalSettings> {
  const existing = await db.fiscalSettings.findFirst({
    where: { organizationId },
  });
  if (existing) return existing;
  return db.fiscalSettings.create({
    data: { organizationId },
  });
}

export async function getFiscalSettings(
  db: TenantClient,
  organizationId: string,
): Promise<FiscalSettings | null> {
  return db.fiscalSettings.findFirst({ where: { organizationId } });
}

export async function saveFiscalSettings(
  db: TenantClient,
  organizationId: string,
  input: unknown,
): Promise<FiscalSettings> {
  const data = fiscalSettingsSchema.parse(input);
  const payload: Record<string, unknown> = {
    taxRegime: data.taxRegime,
    cnae: data.cnae || null,
    nacionalServiceCode: data.nacionalServiceCode || null,
    issRateBasisPoints: data.issRateBasisPoints,
    nfseProvider: data.nfseProvider,
    autoEmitOnPayment: data.autoEmitOnPayment,
    emitProfile: data.emitProfile,
    municipioIbgeCode: data.municipioIbgeCode || null,
    inscricaoMunicipal: data.inscricaoMunicipal || null,
    cbsIbsEnabled: data.cbsIbsEnabled,
    cbsRateBasisPoints: data.cbsIbsEnabled ? data.cbsRateBasisPoints ?? null : null,
    ibsRateBasisPoints: data.cbsIbsEnabled ? data.ibsRateBasisPoints ?? null : null,
  };

  if (data.certificateBase64) {
    payload.certificateEncrypted = encryptPHI(data.certificateBase64);
  }
  if (data.certificatePassword) {
    payload.certificatePasswordEncrypted = encryptPHI(data.certificatePassword);
  }

  return db.fiscalSettings.upsert({
    where: { organizationId },
    create: { organizationId, ...payload },
    update: payload,
  });
}

export function decryptCertificate(settings: FiscalSettings): {
  certificatePfxBase64: string | null;
  certificatePassword: string | null;
} {
  return {
    certificatePfxBase64: settings.certificateEncrypted
      ? decryptPHI(settings.certificateEncrypted)
      : null,
    certificatePassword: settings.certificatePasswordEncrypted
      ? decryptPHI(settings.certificatePasswordEncrypted)
      : null,
  };
}

export function resolveFiscalDocumentType(
  emitProfile: FiscalEmitProfile,
  orgDocumentType: DocumentType,
  orgType: OrganizationType,
): "NFSE" | "RECIBO_RECEITA_SAUDE" {
  if (emitProfile === "NFSE_ONLY") return "NFSE";
  if (emitProfile === "RECEITA_SAUDE_ONLY") return "RECIBO_RECEITA_SAUDE";
  if (
    orgDocumentType === "CPF" ||
    orgType === "PROFISSIONAL_AUTONOMO" ||
    orgType === "CONSULTORIO"
  ) {
    return "RECIBO_RECEITA_SAUDE";
  }
  return "NFSE";
}

export function maskFiscalSettings(settings: FiscalSettings) {
  return {
    ...settings,
    certificateEncrypted: settings.certificateEncrypted ? "[configurado]" : null,
    certificatePasswordEncrypted: settings.certificatePasswordEncrypted
      ? "[configurado]"
      : null,
  };
}
