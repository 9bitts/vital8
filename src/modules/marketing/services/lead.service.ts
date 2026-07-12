import type { LeadStatus } from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { normalizePhoneSearch, type UtmCapture } from "../lib/tracking";

export const LEAD_STATUSES: LeadStatus[] = [
  "NOVO",
  "EM_CONTATO",
  "AGENDOU",
  "COMPARECEU",
  "CONVERTIDO",
  "PERDIDO",
];

export type CreateLeadInput = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  interestServiceId?: string | null;
  leadSourceId?: string | null;
  marketingCampaignId?: string | null;
  branchId?: string | null;
  assignedUserId?: string | null;
  marketingConsentAt?: Date | null;
  marketingConsentIp?: string | null;
  patientId?: string | null;
  appointmentId?: string | null;
  status?: LeadStatus;
} & UtmCapture;

export async function createLead(
  db: TenantClient,
  organizationId: string,
  input: CreateLeadInput,
) {
  const phoneSearch = input.phone ? normalizePhoneSearch(input.phone) : null;
  return db.lead.create({
    data: {
      organizationId,
      fullName: input.fullName.trim(),
      phoneSearch,
      email: input.email?.trim() || null,
      interestServiceId: input.interestServiceId ?? null,
      leadSourceId: input.leadSourceId ?? null,
      marketingCampaignId: input.marketingCampaignId ?? null,
      branchId: input.branchId ?? null,
      assignedUserId: input.assignedUserId ?? null,
      marketingConsentAt: input.marketingConsentAt ?? null,
      marketingConsentIp: input.marketingConsentIp ?? null,
      patientId: input.patientId ?? null,
      appointmentId: input.appointmentId ?? null,
      status: input.status ?? "NOVO",
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      utmTerm: input.utmTerm ?? null,
      utmContent: input.utmContent ?? null,
      lastStatusAt: new Date(),
    },
  });
}

export async function listLeads(
  db: TenantClient,
  organizationId: string,
  filters?: {
    branchId?: string | null;
    status?: LeadStatus;
    leadSourceId?: string;
    marketingCampaignId?: string;
    assignedUserId?: string;
    from?: Date;
    to?: Date;
  },
) {
  return db.lead.findMany({
    where: {
      organizationId,
      ...(filters?.branchId ? { branchId: filters.branchId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.leadSourceId ? { leadSourceId: filters.leadSourceId } : {}),
      ...(filters?.marketingCampaignId
        ? { marketingCampaignId: filters.marketingCampaignId }
        : {}),
      ...(filters?.assignedUserId ? { assignedUserId: filters.assignedUserId } : {}),
      ...(filters?.from || filters?.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ lastStatusAt: "desc" }],
    include: {
      leadSource: { select: { name: true } },
      marketingCampaign: { select: { name: true } },
    },
  });
}

export async function updateLeadStatus(
  db: TenantClient,
  leadId: string,
  status: LeadStatus,
  lossReason?: string | null,
) {
  return db.lead.update({
    where: { id: leadId },
    data: {
      status,
      lossReason: status === "PERDIDO" ? lossReason ?? "Sem motivo" : null,
      lastStatusAt: new Date(),
    },
  });
}

export async function findLeadByPhone(
  db: TenantClient,
  organizationId: string,
  phone: string,
) {
  const phoneSearch = normalizePhoneSearch(phone);
  return db.lead.findFirst({
    where: { organizationId, phoneSearch },
    orderBy: { createdAt: "desc" },
  });
}

export async function addLeadInteraction(
  db: TenantClient,
  organizationId: string,
  leadId: string,
  userId: string,
  type: "LIGACAO" | "WHATSAPP" | "EMAIL" | "NOTA",
  notes: string,
) {
  await db.lead.update({
    where: { id: leadId },
    data: { lastContactAt: new Date() },
  });
  return db.leadInteraction.create({
    data: { organizationId, leadId, userId, type, notes },
  });
}

export function minutesSince(date: Date | null | undefined): number {
  if (!date) return Infinity;
  return Math.floor((Date.now() - date.getTime()) / 60_000);
}

export function isLeadStale(
  lead: { status: LeadStatus; lastContactAt: Date | null; createdAt: Date },
  staleMinutes = 24 * 60,
): boolean {
  if (["CONVERTIDO", "PERDIDO", "COMPARECEU"].includes(lead.status)) return false;
  const ref = lead.lastContactAt ?? lead.createdAt;
  return minutesSince(ref) >= staleMinutes;
}
