import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import { normalizePhone } from "@/lib/crypto/search-hash";
import { getAdsAdapter } from "@/lib/integrations/ads";
import type { UtmCapture } from "../lib/tracking";
import { normalizePhoneSearch } from "../lib/tracking";
import { applyAcquisitionToPatient } from "./lead-conversion.service";
import { createLead, findLeadByPhone } from "./lead.service";
import {
  buildAdsUserData,
  resolveCampaignByUtm,
  resolveLeadSourceByUtm,
} from "./tracking.service";

export async function captureOnlineBookingMarketing(input: {
  organizationId: string;
  patientId: string;
  appointmentId: string;
  phone: string;
  fullName?: string;
  isNewPatient: boolean;
  serviceId: string;
  utm?: UtmCapture;
  ip?: string;
}) {
  const db = createTenantClient(input.organizationId);
  const utm = input.utm ?? {};
  const [campaign, source] = await Promise.all([
    resolveCampaignByUtm(input.organizationId, utm),
    resolveLeadSourceByUtm(input.organizationId, utm),
  ]);

  const status = input.isNewPatient ? "CONVERTIDO" : "AGENDOU";
  const phoneSearch = normalizePhoneSearch(input.phone);

  const existing = await findLeadByPhone(db, input.organizationId, input.phone);
  if (existing) {
    await db.lead.update({
      where: { id: existing.id },
      data: {
        status,
        patientId: input.patientId,
        appointmentId: input.appointmentId,
        interestServiceId: input.serviceId,
        leadSourceId: source?.id ?? existing.leadSourceId,
        marketingCampaignId: campaign?.id ?? existing.marketingCampaignId,
        utmSource: utm.utmSource ?? existing.utmSource,
        utmMedium: utm.utmMedium ?? existing.utmMedium,
        utmCampaign: utm.utmCampaign ?? existing.utmCampaign,
        utmTerm: utm.utmTerm ?? existing.utmTerm,
        utmContent: utm.utmContent ?? existing.utmContent,
        lastStatusAt: new Date(),
      },
    });
  } else {
    await createLead(db, input.organizationId, {
      fullName: input.fullName?.trim() || "Agendamento online",
      phone: input.phone,
      status,
      patientId: input.patientId,
      appointmentId: input.appointmentId,
      interestServiceId: input.serviceId,
      leadSourceId: source?.id,
      marketingCampaignId: campaign?.id,
      marketingConsentIp: input.ip,
      ...utm,
    });
  }

  await applyAcquisitionToPatient(db, input.patientId, {
    ...utm,
    leadSourceId: source?.id,
    marketingCampaignId: campaign?.id,
  });

  const ads = getAdsAdapter();
  await ads.trackEvent({
    event: "schedule",
    eventId: input.appointmentId,
    consentGranted: true,
    userData: buildAdsUserData({
      phone: phoneSearch,
      hasMarketingConsent: true,
    }),
    customData: {
      source: source?.slug ?? "online_booking",
      campaign: campaign?.name ?? "",
      new_patient: input.isNewPatient ? 1 : 0,
    },
  });

  return { status, campaignId: campaign?.id, sourceId: source?.id };
}

export async function patientExistedBeforeBooking(
  organizationId: string,
  phone: string,
): Promise<boolean> {
  const digits = normalizePhone(phone);
  const patient = await adminPrisma.patient.findFirst({
    where: { organizationId, phoneSearch: digits, deletedAt: null },
  });
  return Boolean(patient);
}
