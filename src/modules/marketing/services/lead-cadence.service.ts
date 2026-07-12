import type { TenantClient } from "@/lib/db/tenant-client";
import { adminPrisma } from "@/lib/db/admin-client";
import { createNotification } from "@/modules/analytics/services/notification.service";
import { renderMessageTemplate } from "@/modules/engagement/lib/template-renderer";
import { isLeadStale } from "./lead.service";

const STALE_HOURS = 24;

export async function isLeadMarketingOptedOut(
  organizationId: string,
  phoneSearch?: string | null,
  email?: string | null,
): Promise<boolean> {
  if (!phoneSearch && !email) return false;
  const row = await adminPrisma.leadOptOut.findFirst({
    where: {
      organizationId,
      OR: [
        ...(phoneSearch ? [{ phoneSearch }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
  });
  return !!row;
}

export async function recordLeadOptOut(
  organizationId: string,
  phoneSearch?: string | null,
  email?: string | null,
) {
  return adminPrisma.leadOptOut.create({
    data: {
      organizationId,
      phoneSearch: phoneSearch ?? null,
      email: email ?? null,
    },
  });
}

export async function enqueueLeadFollowUp(
  db: TenantClient,
  input: {
    organizationId: string;
    leadId: string;
    channel: "WHATSAPP" | "SMS" | "EMAIL";
    body: string;
    templateId?: string;
    scheduledFor?: Date;
    idempotencyKey: string;
  },
) {
  const existing = await db.leadFollowUpLog.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return existing;

  return db.leadFollowUpLog.create({
    data: {
      organizationId: input.organizationId,
      leadId: input.leadId,
      templateId: input.templateId ?? null,
      channel: input.channel,
      renderedBody: input.body,
      scheduledFor: input.scheduledFor ?? new Date(),
      idempotencyKey: input.idempotencyKey,
    },
  });
}

export function shouldSendLeadFollowUp(
  lead: { marketingConsentAt: Date | null },
  optedOut: boolean,
): { send: boolean; reason?: string } {
  if (!lead.marketingConsentAt) {
    return { send: false, reason: "Sem consentimento de marketing" };
  }
  if (optedOut) {
    return { send: false, reason: "Opt-out de marketing" };
  }
  return { send: true };
}

export async function processLeadFollowUpQueue(db: TenantClient, limit = 50) {
  const pending = await db.leadFollowUpLog.findMany({
    where: {
      status: "FILA",
      scheduledFor: { lte: new Date() },
    },
    take: limit,
    include: { lead: true },
  });

  let sent = 0;
  let skipped = 0;

  for (const row of pending) {
    const lead = row.lead;
    const optedOut = await isLeadMarketingOptedOut(
      row.organizationId,
      lead.phoneSearch,
      lead.email,
    );
    const decision = shouldSendLeadFollowUp(lead, optedOut);
    if (!decision.send) {
      await db.leadFollowUpLog.update({
        where: { id: row.id },
        data: { status: "FALHA", failReason: decision.reason },
      });
      skipped++;
      continue;
    }

    await db.leadFollowUpLog.update({
      where: { id: row.id },
      data: { status: "ENVIADO", sentAt: new Date() },
    });
    sent++;
  }

  return { sent, skipped };
}

export async function scheduleNewLeadCadence(
  db: TenantClient,
  organizationId: string,
  leadId: string,
) {
  const template = await db.messageTemplate.findFirst({
    where: { organizationId, name: { contains: "lead" }, isActive: true },
  });
  const body = template
    ? renderMessageTemplate(template.body, { paciente: "lead" })
    : "Olá! Recebemos seu contato. Em breve nossa equipe retorna.";

  return enqueueLeadFollowUp(db, {
    organizationId,
    leadId,
    channel: "WHATSAPP",
    body,
    templateId: template?.id,
    scheduledFor: new Date(Date.now() + 5 * 60_000),
    idempotencyKey: `lead-new-${leadId}`,
  });
}

export async function scanStaleLeads(db: TenantClient, organizationId: string) {
  const leads = await db.lead.findMany({
    where: {
      organizationId,
      status: { in: ["NOVO", "EM_CONTATO", "AGENDOU"] },
    },
  });

  const staleMinutes = STALE_HOURS * 60;
  const stale = leads.filter((l) => isLeadStale(l, staleMinutes));

  for (const lead of stale) {
    if (!lead.assignedUserId) continue;
    await createNotification({
      organizationId,
      userId: lead.assignedUserId,
      type: "LEAD_STALE",
      title: "Lead esfriando",
      body: `${lead.fullName} sem contato há mais de ${STALE_HOURS}h`,
      metadata: { leadId: lead.id },
    });
  }

  return { staleCount: stale.length };
}

export async function runLeadCadenceScanners(db: TenantClient, organizationId: string) {
  await scanStaleLeads(db, organizationId);
  await processLeadFollowUpQueue(db);
}
