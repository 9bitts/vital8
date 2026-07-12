import { createHash } from "crypto";
import { adminPrisma } from "@/lib/db/admin-client";
import type { UtmCapture } from "../lib/tracking";

export function hashAdsIdentifier(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export async function resolveCampaignByUtm(
  organizationId: string,
  utm: UtmCapture,
) {
  if (!utm.utmCampaign) return null;
  return adminPrisma.marketingCampaign.findFirst({
    where: {
      organizationId,
      OR: [
        { utmCampaign: utm.utmCampaign },
        { name: utm.utmCampaign },
      ],
      isActive: true,
    },
  });
}

export async function resolveLeadSourceByUtm(
  organizationId: string,
  utm: UtmCapture,
) {
  const slug = (utm.utmSource ?? utm.utmMedium ?? "").toLowerCase();
  if (!slug) return null;
  return adminPrisma.leadSource.findFirst({
    where: { organizationId, slug },
  });
}

export async function createTrackedLink(input: {
  organizationId: string;
  code: string;
  targetUrl: string;
  marketingCampaignId?: string;
}) {
  return adminPrisma.trackedLink.create({
    data: input,
  });
}

export async function recordTrackedClick(code: string) {
  const link = await adminPrisma.trackedLink.findUnique({ where: { code } });
  if (!link) return null;
  return adminPrisma.trackedLink.update({
    where: { code },
    data: { clickCount: { increment: 1 } },
  });
}

export function buildAdsUserData(input: {
  email?: string | null;
  phone?: string | null;
  hasMarketingConsent: boolean;
}) {
  if (!input.hasMarketingConsent) return {};
  const data: Record<string, string> = {};
  if (input.email) data.em = hashAdsIdentifier(input.email);
  if (input.phone) data.ph = hashAdsIdentifier(input.phone);
  return data;
}
