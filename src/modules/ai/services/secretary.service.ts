import { encryptPHI, decryptPHI } from "@/lib/crypto/phi";
import { adminPrisma } from "@/lib/db/admin-client";
import { getAvailabilityRange } from "@/modules/api/services/availability.service";
import { createAppointment } from "@/modules/scheduling/services/appointment.service";
import { aiComplete } from "./llm-gateway.service";

export type SecretaryIntent =
  | "agendar"
  | "remarcar"
  | "cancelar"
  | "confirmar"
  | "duvida_preparo"
  | "horario_funcionamento"
  | "duvida_geral"
  | "humano"
  | "clinico";

const CLINICAL_PATTERN =
  /dor|sintoma|medicamento|diagnóst|exame|resultado|gravidez|febre|pressão|remédio|tratamento/i;

export function detectSecretaryIntent(text: string): SecretaryIntent {
  if (CLINICAL_PATTERN.test(text)) return "clinico";
  const t = text.toLowerCase();
  if (/humano|atendente|falar com/.test(t)) return "humano";
  if (/cancel/.test(t)) return "cancelar";
  if (/remarc/.test(t)) return "remarcar";
  if (/confirm/.test(t)) return "confirmar";
  if (/preparo|jejum/.test(t)) return "duvida_preparo";
  if (/hor[aá]rio|funcionamento|abre/.test(t)) return "horario_funcionamento";
  if (/agend|marcar|consulta/.test(t)) return "agendar";
  return "duvida_geral";
}

export function isSilenceHour(now: Date, startHour?: number | null, endHour?: number | null): boolean {
  if (startHour == null || endHour == null) return false;
  const h = now.getHours();
  if (startHour <= endHour) return h >= startHour && h < endHour;
  return h >= startHour || h < endHour;
}

async function appendMessage(
  conversationId: string,
  organizationId: string,
  role: "USER" | "ASSISTANT" | "SYSTEM",
  content: string,
) {
  return adminPrisma.aiConversationMessage.create({
    data: {
      conversationId,
      organizationId,
      role,
      contentEncrypted: encryptPHI(content),
    },
  });
}

export async function processSecretaryMessage(input: {
  organizationId: string;
  phone: string;
  message: string;
  conversationId?: string;
  simulate?: boolean;
}) {
  const settings = await adminPrisma.aiSettings.findUnique({
    where: { organizationId: input.organizationId },
  });

  if (isSilenceHour(new Date(), settings?.silenceStartHour, settings?.silenceEndHour)) {
    return {
      reply: "Estamos fora do horário de atendimento automático. Nossa equipe retornará em breve.",
      intent: "silencio" as const,
      handoff: false,
    };
  }

  let conversation = input.conversationId
    ? await adminPrisma.aiConversation.findFirst({
        where: { id: input.conversationId, organizationId: input.organizationId },
      })
    : await adminPrisma.aiConversation.findFirst({
        where: {
          organizationId: input.organizationId,
          externalPhone: input.phone,
          status: "ACTIVE",
        },
        orderBy: { updatedAt: "desc" },
      });

  if (!conversation) {
    const patient = await adminPrisma.patient.findFirst({
      where: {
        organizationId: input.organizationId,
        phoneSearch: { contains: input.phone.replace(/\D/g, "").slice(-8) },
        deletedAt: null,
      },
    });
    conversation = await adminPrisma.aiConversation.create({
      data: {
        organizationId: input.organizationId,
        externalPhone: input.phone,
        patientId: patient?.id ?? null,
        channel: "WHATSAPP",
      },
    });
  }

  await appendMessage(conversation.id, input.organizationId, "USER", input.message);

  const intent = detectSecretaryIntent(input.message);

  if (intent === "clinico") {
    const reply =
      "Não posso orientações clínicas. Vou encaminhar sua mensagem ao profissional de saúde.";
    await adminPrisma.aiConversation.update({
      where: { id: conversation.id },
      data: {
        status: "HANDOFF",
        lastIntent: intent,
        outcome: "escalated_clinical",
        handoffContextEncrypted: encryptPHI(input.message),
      },
    });
    await appendMessage(conversation.id, input.organizationId, "ASSISTANT", reply);
    return { reply, intent, handoff: true, conversationId: conversation.id };
  }

  if (intent === "humano") {
    const reply = "Transferindo para a recepção. Um atendente humano continuará em breve.";
    await adminPrisma.aiConversation.update({
      where: { id: conversation.id },
      data: {
        status: "HANDOFF",
        lastIntent: intent,
        outcome: "handoff",
        handoffContextEncrypted: encryptPHI(
          JSON.stringify({ lastMessage: input.message, phone: input.phone }),
        ),
      },
    });
    await appendMessage(conversation.id, input.organizationId, "ASSISTANT", reply);
    return { reply, intent, handoff: true, conversationId: conversation.id };
  }

  const faq = await adminPrisma.aiFaq.findFirst({
    where: {
      organizationId: input.organizationId,
      isActive: true,
      question: { contains: input.message.slice(0, 20), mode: "insensitive" },
    },
  });

  if (faq) {
    await appendMessage(conversation.id, input.organizationId, "ASSISTANT", faq.answer);
    return { reply: faq.answer, intent: "faq", handoff: false, conversationId: conversation.id };
  }

  const state = (conversation.sessionState ?? {}) as Record<string, unknown>;

  if (intent === "agendar" || state.flow === "booking") {
    const bookingReply = await handleBookingFlow(
      input.organizationId,
      conversation.id,
      conversation.patientId,
      state,
      input.message,
    );
    await appendMessage(conversation.id, input.organizationId, "ASSISTANT", bookingReply.reply);
    return {
      reply: bookingReply.reply,
      intent: "agendar",
      handoff: false,
      conversationId: conversation.id,
      scheduled: bookingReply.scheduled,
    };
  }

  const { text } = await aiComplete({
    organizationId: input.organizationId,
    resource: "VIRTUAL_SECRETARY",
    system: "SECRETARY: assistente de agendamento. Nunca invente horários ou preços.",
    userMessage: input.message,
    skipConsent: input.simulate,
  });

  await adminPrisma.aiConversation.update({
    where: { id: conversation.id },
    data: { lastIntent: intent },
  });
  await appendMessage(conversation.id, input.organizationId, "ASSISTANT", text);

  return { reply: text, intent, handoff: false, conversationId: conversation.id };
}

async function handleBookingFlow(
  organizationId: string,
  conversationId: string,
  patientId: string | null,
  state: Record<string, unknown>,
  message: string,
) {
  const { createTenantClient } = await import("@/lib/db/tenant-client");
  const db = createTenantClient(organizationId);

  if (!patientId) {
    await adminPrisma.aiConversation.update({
      where: { id: conversationId },
      data: { sessionState: { flow: "booking", step: "identify" } },
    });
    return {
      reply: "Para agendar, preciso identificar seu cadastro. Informe o telefone cadastrado na clínica.",
      scheduled: false,
    };
  }

  const professionals = await db.professional.findMany({
    where: { isActive: true },
    take: 1,
  });
  const services = await db.service.findMany({
    where: { isActive: true, allowOnlineBooking: true },
    take: 1,
  });

  if (!professionals[0] || !services[0]) {
    return { reply: "No momento não há horários disponíveis para agendamento online.", scheduled: false };
  }

  const from = new Date();
  from.setDate(from.getDate() + 1);
  from.setHours(8, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);

  const slots = await getAvailabilityRange(db, {
    professionalId: professionals[0].id,
    serviceId: services[0].id,
    from,
    to,
  });

  if (slots.length === 0) {
    return { reply: "Não encontrei horários livres nos próximos dias.", scheduled: false };
  }

  const offered = slots.slice(0, 3);
  const slotLabels = offered.map((s) => s.startsAt.toISOString());

  if (state.step === "confirm_slot" && state.selectedSlot) {
    try {
      await createAppointment(db, organizationId, "ai:secretary", {
        patientId,
        professionalId: professionals[0].id,
        serviceId: services[0].id,
        startsAt: new Date(String(state.selectedSlot)),
        origin: "ONLINE",
        sendConfirmation: true,
      });
      await adminPrisma.aiConversation.update({
        where: { id: conversationId },
        data: { sessionState: {}, status: "COMPLETED", outcome: "scheduled" },
      });
      return {
        reply: `Agendamento confirmado para ${new Date(String(state.selectedSlot)).toLocaleString("pt-BR")}.`,
        scheduled: true,
      };
    } catch {
      return { reply: "Esse horário não está mais disponível. Escolha outro.", scheduled: false };
    }
  }

  const isoMatch = message.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/);
  const picked = isoMatch?.[0];
  const validPick = picked && slotLabels.includes(picked) ? picked : null;

  if (validPick) {
    await adminPrisma.aiConversation.update({
      where: { id: conversationId },
      data: { sessionState: { flow: "booking", step: "confirm_slot", selectedSlot: validPick } },
    });
    return {
      reply: `Confirmar agendamento em ${new Date(validPick).toLocaleString("pt-BR")}? Responda "sim".`,
      scheduled: false,
    };
  }

  if (/^sim$/i.test(message.trim()) && state.selectedSlot) {
    return handleBookingFlow(organizationId, conversationId, patientId, {
      ...state,
      step: "confirm_slot",
    }, message);
  }

  await adminPrisma.aiConversation.update({
    where: { id: conversationId },
    data: { sessionState: { flow: "booking", step: "pick_slot", slots: slotLabels } },
  });

  const options = offered
    .map((s, i) => `${i + 1}. ${s.startsAt.toLocaleString("pt-BR")} (${s.startsAt.toISOString()})`)
    .join("\n");

  return {
    reply: `Horários disponíveis (somente slots reais do sistema):\n${options}\n\nResponda com o horário ISO desejado.`,
    scheduled: false,
  };
}

export async function listConversationMessages(conversationId: string, organizationId: string) {
  const rows = await adminPrisma.aiConversationMessage.findMany({
    where: { conversationId, organizationId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: decryptPHI(r.contentEncrypted),
    createdAt: r.createdAt,
  }));
}
