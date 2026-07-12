import type { TenantClient } from "@/lib/db/tenant-client";
import { encryptPHI } from "@/lib/crypto/phi";
import { hashCpf } from "@/lib/crypto/search-hash";
import { normalizeSearchName } from "@/lib/crypto/search-hash";
import {
  createQuickPatient,
  findDuplicatesForInput,
} from "@/modules/patients/services/patient.service";
import { normalizePhoneSearch } from "../lib/tracking";
import type { UtmCapture } from "../lib/tracking";
import { updateLeadStatus } from "./lead.service";

export type AcquisitionData = UtmCapture & {
  leadSourceId?: string | null;
  marketingCampaignId?: string | null;
  referralSource?: string | null;
};

export async function applyAcquisitionToPatient(
  db: TenantClient,
  patientId: string,
  data: AcquisitionData,
) {
  return db.patient.update({
    where: { id: patientId },
    data: {
      utmSource: data.utmSource ?? undefined,
      utmMedium: data.utmMedium ?? undefined,
      utmCampaign: data.utmCampaign ?? undefined,
      utmTerm: data.utmTerm ?? undefined,
      utmContent: data.utmContent ?? undefined,
      leadSourceId: data.leadSourceId ?? undefined,
      marketingCampaignId: data.marketingCampaignId ?? undefined,
      referralSource: data.referralSource ?? undefined,
      acquiredAt: new Date(),
    },
  });
}

export async function convertLeadToPatient(
  db: TenantClient,
  organizationId: string,
  leadId: string,
  options?: { cpf?: string; birthDate?: string },
) {
  const lead = await db.lead.findFirstOrThrow({ where: { id: leadId } });
  if (lead.patientId) {
    return { patientId: lead.patientId, created: false };
  }

  const phone = lead.phoneSearch ?? "";
  let duplicates = await findDuplicatesForInput(db, organizationId, {
    fullName: lead.fullName,
    cpf: options?.cpf,
  });
  if (phone) {
    const byPhone = await db.patient.findFirst({
      where: { organizationId, phoneSearch: normalizePhoneSearch(phone) },
    });
    if (byPhone && !duplicates.some((d) => d.id === byPhone.id)) {
      duplicates = [...duplicates, byPhone as never];
    }
  }
  if (duplicates.length > 0) {
    const existing = duplicates[0]!;
    await applyAcquisitionToPatient(db, existing.id, {
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      utmCampaign: lead.utmCampaign,
      utmTerm: lead.utmTerm,
      utmContent: lead.utmContent,
      leadSourceId: lead.leadSourceId,
      marketingCampaignId: lead.marketingCampaignId,
    });
    await db.lead.update({
      where: { id: leadId },
      data: { patientId: existing.id, status: "CONVERTIDO", lastStatusAt: new Date() },
    });
    return { patientId: existing.id, created: false, deduplicated: true };
  }

  let patient;
  if (options?.cpf) {
    const phones = phone ? [{ number: phone, label: "Principal" }] : [];
    patient = await db.patient.create({
      data: {
        organizationId,
        searchName: normalizeSearchName(lead.fullName),
        fullName: lead.fullName,
        cpfEncrypted: encryptPHI(options.cpf),
        cpfHash: hashCpf(options.cpf, organizationId),
        phonesEncrypted: phones.length ? encryptPHI(JSON.stringify(phones)) : null,
        phoneSearch: phone ? normalizePhoneSearch(phone) : null,
        emailEncrypted: lead.email ? encryptPHI(lead.email) : null,
        birthDate: options.birthDate ? new Date(options.birthDate) : null,
        isIncomplete: false,
        utmSource: lead.utmSource,
        utmMedium: lead.utmMedium,
        utmCampaign: lead.utmCampaign,
        utmTerm: lead.utmTerm,
        utmContent: lead.utmContent,
        leadSourceId: lead.leadSourceId,
        marketingCampaignId: lead.marketingCampaignId,
        acquiredAt: new Date(),
      },
    });
  } else {
    patient = await createQuickPatient(db, organizationId, {
      fullName: lead.fullName,
      phone: phone || "00000000000",
    });
    await applyAcquisitionToPatient(db, patient.id, {
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      utmCampaign: lead.utmCampaign,
      utmTerm: lead.utmTerm,
      utmContent: lead.utmContent,
      leadSourceId: lead.leadSourceId,
      marketingCampaignId: lead.marketingCampaignId,
    });
  }

  await updateLeadStatus(db, leadId, "CONVERTIDO");
  await db.lead.update({
    where: { id: leadId },
    data: { patientId: patient.id },
  });

  return { patientId: patient.id, created: true };
}
