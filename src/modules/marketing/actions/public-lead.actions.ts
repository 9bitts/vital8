"use server";

import { headers } from "next/headers";
import { adminPrisma } from "@/lib/db/admin-client";
import { checkRateLimit } from "@/modules/engagement/lib/rate-limit";
import { getAdsAdapter } from "@/lib/integrations/ads";
import { buildAdsUserData } from "../services/tracking.service";
import {
  resolveCampaignByUtm,
  resolveLeadSourceByUtm,
} from "../services/tracking.service";
import { publicLeadCaptureSchema } from "../schemas/marketing.schema";
import { createLead } from "../services/lead.service";
import { createTenantClient } from "@/lib/db/tenant-client";
import { hasOrgFeature } from "@/lib/features/subscription.service";
import { scheduleNewLeadCadence } from "../services/lead-cadence.service";
import { normalizePhoneSearch } from "../lib/tracking";

export async function capturePublicLeadAction(input: unknown) {
  const parsed = publicLeadCaptureSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const data = parsed.data;
  if (data.honeypot) {
    return { success: false as const, error: "Spam detectado" };
  }

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = checkRateLimit(`lead-capture:${ip}`, 10, 60_000);
  if (!rate.allowed) {
    return { success: false as const, error: "Muitas tentativas. Aguarde." };
  }

  const org = await adminPrisma.organization.findFirst({
    where: { slug: data.orgSlug, isActive: true, deletedAt: null },
    select: { id: true, plan: true },
  });
  if (!org) return { success: false as const, error: "Organização não encontrada" };

  const marketingOk = await hasOrgFeature(org.id, "marketing");
  if (!marketingOk) {
    return { success: false as const, error: "Captação indisponível neste plano" };
  }

  const utm = {
    utmSource: data.utmSource,
    utmMedium: data.utmMedium,
    utmCampaign: data.utmCampaign,
    utmTerm: data.utmTerm,
    utmContent: data.utmContent,
  };

  const [campaign, source] = await Promise.all([
    resolveCampaignByUtm(org.id, utm),
    resolveLeadSourceByUtm(org.id, utm),
  ]);

  const db = createTenantClient(org.id);
  const lead = await createLead(db, org.id, {
    fullName: data.fullName,
    phone: data.phone,
    email: data.email,
    marketingConsentAt: new Date(),
    marketingConsentIp: ip,
    leadSourceId: source?.id,
    marketingCampaignId: campaign?.id,
    ...utm,
  });

  await scheduleNewLeadCadence(db, org.id, lead.id);

  const ads = getAdsAdapter();
  await ads.trackEvent({
    event: "lead",
    eventId: lead.id,
    consentGranted: true,
    userData: buildAdsUserData({
      email: data.email,
      phone: normalizePhoneSearch(data.phone),
      hasMarketingConsent: true,
    }),
    customData: {
      lead_source: source?.slug ?? "direct",
      campaign: campaign?.name ?? "",
    },
  });

  return { success: true as const, data: { leadId: lead.id } };
}
