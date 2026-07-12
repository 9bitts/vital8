import type { SignatureSettings, SignatureProvider } from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { decryptPHI, encryptPHI } from "@/lib/crypto/phi";
import { signatureSettingsSchema } from "../schemas/signature.schema";

export async function getOrCreateSignatureSettings(
  db: TenantClient,
  organizationId: string,
): Promise<SignatureSettings> {
  const existing = await db.signatureSettings.findFirst({ where: { organizationId } });
  if (existing) return existing;
  return db.signatureSettings.create({ data: { organizationId } });
}

export async function saveSignatureSettings(
  db: TenantClient,
  organizationId: string,
  input: unknown,
): Promise<SignatureSettings> {
  const data = signatureSettingsSchema.parse(input);
  const payload: Record<string, unknown> = {
    provider: data.provider,
    timestampEnabled: data.timestampEnabled,
    dsasApiUrl: data.dsasApiUrl || null,
  };

  if (data.certificateBase64) {
    payload.certificateEncrypted = encryptPHI(data.certificateBase64);
  }
  if (data.certificatePassword) {
    payload.certificatePasswordEncrypted = encryptPHI(data.certificatePassword);
  }
  if (data.dsasApiKey) {
    payload.dsasApiKeyEncrypted = encryptPHI(data.dsasApiKey);
  }

  return db.signatureSettings.upsert({
    where: { organizationId },
    create: { organizationId, ...payload },
    update: payload,
  });
}

export function decryptSignatureSecrets(settings: SignatureSettings): {
  certificatePfxBase64: string | null;
  certificatePassword: string | null;
  dsasApiKey: string | null;
} {
  return {
    certificatePfxBase64: settings.certificateEncrypted
      ? decryptPHI(settings.certificateEncrypted)
      : null,
    certificatePassword: settings.certificatePasswordEncrypted
      ? decryptPHI(settings.certificatePasswordEncrypted)
      : null,
    dsasApiKey: settings.dsasApiKeyEncrypted
      ? decryptPHI(settings.dsasApiKeyEncrypted)
      : null,
  };
}

export function maskSignatureSettings(settings: SignatureSettings) {
  return {
    ...settings,
    certificateEncrypted: settings.certificateEncrypted ? "[configurado]" : null,
    certificatePasswordEncrypted: settings.certificatePasswordEncrypted
      ? "[configurado]"
      : null,
    dsasApiKeyEncrypted: settings.dsasApiKeyEncrypted ? "[configurado]" : null,
  };
}

export function providerLabel(provider: SignatureProvider): string {
  const labels: Record<SignatureProvider, string> = {
    DEV_SIMPLE: "Desenvolvimento (sem ICP)",
    ICP_A1: "ICP-Brasil A1 (servidor)",
    ICP_DSAS: "ICP-Brasil DSaS (API)",
    ICP_LACUNA: "ICP-Brasil Lacuna (BirdID/VIDaaS)",
  };
  return labels[provider];
}
