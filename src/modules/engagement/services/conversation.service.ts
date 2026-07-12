import { adminPrisma } from "@/lib/db/admin-client";
import type { CommunicationChannel, ConversationMessageDirection } from "@/generated/prisma/client";
import { processSecretaryMessage } from "@/modules/ai/services/secretary.service";
import { getMessagingAdapter } from "@/lib/integrations/messaging";
import { normalizeWhatsAppPhone } from "@/lib/integrations/messaging/whatsapp-phone";
import { setOptOut } from "./opt-out.service";

function normalizePhone(phone: string): string {
  return normalizeWhatsAppPhone(phone) ?? phone.replace(/\D/g, "");
}

export async function findOrCreateThread(
  organizationId: string,
  phone: string,
  patientId?: string | null,
) {
  const normalized = normalizePhone(phone);
  const existing = await adminPrisma.conversationThread.findFirst({
    where: { organizationId, phone: normalized },
  });
  if (existing) return existing;

  return adminPrisma.conversationThread.create({
    data: {
      organizationId,
      phone: normalized,
      patientId: patientId ?? null,
    },
  });
}

export async function appendConversationMessage(input: {
  threadId: string;
  organizationId: string;
  direction: ConversationMessageDirection;
  channel: CommunicationChannel;
  body: string;
  communicationLogId?: string;
  externalMessageId?: string;
  sentByUserId?: string;
}) {
  await adminPrisma.conversationMessage.create({ data: input });
  await adminPrisma.conversationThread.update({
    where: { id: input.threadId },
    data: { lastMessageAt: new Date() },
  });
}

export async function listConversationThreads(organizationId: string) {
  return adminPrisma.conversationThread.findMany({
    where: { organizationId },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      patient: { select: { id: true, fullName: true, socialName: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export async function getThreadMessages(threadId: string, organizationId: string) {
  return adminPrisma.conversationMessage.findMany({
    where: { threadId, organizationId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
}

export async function assignThread(
  threadId: string,
  organizationId: string,
  userId: string | null,
) {
  return adminPrisma.conversationThread.updateMany({
    where: { id: threadId, organizationId },
    data: { assignedUserId: userId },
  });
}

export async function handleInboundWhatsApp(input: {
  organizationId: string;
  from: string;
  messageId: string;
  body: string;
  buttonPayload?: string;
}) {
  const phone = normalizePhone(input.from);
  const patient = await adminPrisma.patient.findFirst({
    where: {
      organizationId: input.organizationId,
      phoneSearch: { contains: phone.slice(-8) },
      deletedAt: null,
    },
  });

  const thread = await findOrCreateThread(
    input.organizationId,
    phone,
    patient?.id,
  );

  await appendConversationMessage({
    threadId: thread.id,
    organizationId: input.organizationId,
    direction: "INBOUND",
    channel: "WHATSAPP",
    body: input.body || input.buttonPayload || "",
    externalMessageId: input.messageId,
  });

  if (input.buttonPayload === "OPT_OUT") {
    if (patient) {
      await setOptOut(input.organizationId, patient.id, "MARKETING", "WHATSAPP");
      await setOptOut(input.organizationId, patient.id, "TRANSACIONAL", "WHATSAPP");
    }
    return { reply: "Você não receberá mais mensagens por este canal." };
  }

  const confirmMatch = input.buttonPayload?.match(/^confirm_(.+)$/);
  if (confirmMatch) {
    const token = confirmMatch[1];
    const confirmation = await adminPrisma.appointmentConfirmation.findFirst({
      where: { token, organizationId: input.organizationId, status: "PENDENTE" },
    });
    if (confirmation) {
      await adminPrisma.appointmentConfirmation.update({
        where: { id: confirmation.id },
        data: { status: "CONFIRMADO", respondedAt: new Date() },
      });
      await adminPrisma.appointment.update({
        where: { id: confirmation.appointmentId },
        data: { status: "CONFIRMADO" },
      });
      return { reply: "Consulta confirmada! Obrigado." };
    }
  }

  const cancelMatch = input.buttonPayload?.match(/^cancel_(.+)$/);
  if (cancelMatch) {
    const token = cancelMatch[1];
    const confirmation = await adminPrisma.appointmentConfirmation.findFirst({
      where: { token, organizationId: input.organizationId, status: "PENDENTE" },
    });
    if (confirmation) {
      await adminPrisma.appointmentConfirmation.update({
        where: { id: confirmation.id },
        data: { status: "CANCELADO", respondedAt: new Date() },
      });
      await adminPrisma.appointment.update({
        where: { id: confirmation.appointmentId },
        data: {
          status: "CANCELADO",
          cancelReason: "Cancelado via WhatsApp",
        },
      });
      return { reply: "Consulta cancelada conforme solicitado." };
    }
  }

  const secretary = await processSecretaryMessage({
    organizationId: input.organizationId,
    phone,
    message: input.body,
  });

  if (secretary.handoff) {
    await adminPrisma.conversationThread.update({
      where: { id: thread.id },
      data: { status: "HANDOFF" },
    });
  }

  await appendConversationMessage({
    threadId: thread.id,
    organizationId: input.organizationId,
    direction: "OUTBOUND",
    channel: "WHATSAPP",
    body: secretary.reply,
  });

  const messaging = getMessagingAdapter();
  await messaging.send({
    channel: "WHATSAPP",
    to: phone,
    body: secretary.reply,
    organizationId: input.organizationId,
    metadata: { threadId: thread.id },
  });

  return { reply: secretary.reply };
}

export async function sendThreadReply(
  organizationId: string,
  threadId: string,
  userId: string,
  body: string,
) {
  const thread = await adminPrisma.conversationThread.findFirstOrThrow({
    where: { id: threadId, organizationId },
  });

  const messaging = getMessagingAdapter();
  const result = await messaging.send({
    channel: "WHATSAPP",
    to: thread.phone,
    body,
    organizationId,
    metadata: { threadId },
  });

  if (!result.success) {
    throw new Error(result.error ?? "Falha ao enviar");
  }

  await appendConversationMessage({
    threadId,
    organizationId,
    direction: "OUTBOUND",
    channel: "WHATSAPP",
    body,
    sentByUserId: userId,
    externalMessageId: result.messageId,
  });

  return result;
}
