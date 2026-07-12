import { adminPrisma } from "@/lib/db/admin-client";
import {
  ENTITY_TYPE_LABELS,
} from "./clinical-signature.service";
import { providerLabel } from "./signature-settings.service";

export type VerificationResult = {
  valid: boolean;
  verificationCode: string;
  entityType: string;
  entityTypeLabel: string;
  organizationName: string;
  signerName: string;
  signedAt: Date;
  contentHash: string;
  signatureMethod: string;
  signatureMethodLabel: string;
  hasTimestamp: boolean;
  timestampToken?: string | null;
};

/** Verificação pública — sem PHI (paciente, conteúdo clínico). */
export async function verifyByCode(
  code: string,
): Promise<VerificationResult | null> {
  const normalized = code.trim().toUpperCase();
  const doc = await adminPrisma.signedClinicalDocument.findFirst({
    where: { verificationCode: normalized },
    include: {
      organization: { select: { name: true, isActive: true } },
    },
  });

  if (!doc || !doc.organization.isActive) return null;

  return {
    valid: true,
    verificationCode: doc.verificationCode,
    entityType: doc.entityType,
    entityTypeLabel: ENTITY_TYPE_LABELS[doc.entityType],
    organizationName: doc.organization.name,
    signerName: doc.signerName,
    signedAt: doc.signedAt,
    contentHash: doc.contentHash,
    signatureMethod: doc.signatureMethod,
    signatureMethodLabel: providerLabel(doc.signatureMethod),
    hasTimestamp: Boolean(doc.timestampToken),
    timestampToken: doc.timestampToken
      ? `${doc.timestampToken.slice(0, 16)}…`
      : null,
  };
}
