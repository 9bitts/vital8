import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import { listConversationMessages } from "@/modules/ai/services/secretary.service";
import { normalizePhoneSearch } from "../lib/tracking";
import { createLead, findLeadByPhone } from "./lead.service";

export async function captureSecretaryLeadIfNeeded(input: {
  organizationId: string;
  phone: string;
  conversationId: string;
  scheduled?: boolean;
  handoff?: boolean;
}) {
  if (input.scheduled || input.handoff) return null;

  const messages = await listConversationMessages(input.conversationId, input.organizationId);
  if (messages.length < 2) return null;

  const db = createTenantClient(input.organizationId);

  const systemUser = await adminPrisma.membership.findFirst({
    where: { organizationId: input.organizationId, role: { in: ["OWNER", "ADMIN"] } },
    select: { userId: true },
  });
  const interactionUserId = systemUser?.userId;

  const existing = await findLeadByPhone(db, input.organizationId, input.phone);
  if (existing && ["AGENDOU", "COMPARECEU", "CONVERTIDO"].includes(existing.status)) {
    return existing;
  }

  const transcript = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")
    .slice(0, 4000);

  const displayName =
    messages.find((m) => m.role === "USER")?.content.slice(0, 40) || "Contato WhatsApp";

  if (existing) {
    await db.lead.update({
      where: { id: existing.id },
      data: {
        status: "EM_CONTATO",
        lastContactAt: new Date(),
        lastStatusAt: new Date(),
      },
    });
    if (interactionUserId) {
      await db.leadInteraction.create({
        data: {
          organizationId: input.organizationId,
          leadId: existing.id,
          userId: interactionUserId,
          type: "WHATSAPP",
          notes: `Transcrição secretária IA:\n${transcript}`,
        },
      });
    }
    return existing;
  }

  const lead = await createLead(db, input.organizationId, {
    fullName: displayName,
    phone: input.phone,
    status: "EM_CONTATO",
    leadSourceId: null,
    marketingConsentAt: null,
  });

  if (interactionUserId) {
    await db.leadInteraction.create({
      data: {
        organizationId: input.organizationId,
        leadId: lead.id,
        userId: interactionUserId,
        type: "WHATSAPP",
        notes: `Transcrição secretária IA:\n${transcript}`,
      },
    });
  }

  return lead;
}

export function secretaryLeadPhoneKey(phone: string): string {
  return normalizePhoneSearch(phone);
}
