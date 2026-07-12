"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, type ActionResult } from "@/lib/auth/guards";
import { aiComplete } from "@/modules/ai/services/llm-gateway.service";
import {
  assignThread,
  getThreadMessages,
  listConversationThreads,
  sendThreadReply,
} from "../services/conversation.service";

export async function listConversationsAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
  return listConversationThreads(ctx.organizationId);
}

export async function getConversationMessagesAction(threadId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
  return getThreadMessages(threadId, ctx.organizationId);
}

export async function assignConversationAction(
  threadId: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
    await assignThread(threadId, ctx.organizationId, ctx.userId);
    revalidatePath("/app/relacionamento/conversas");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function replyConversationAction(
  threadId: string,
  body: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
    await sendThreadReply(ctx.organizationId, threadId, ctx.userId, body);
    revalidatePath("/app/relacionamento/conversas");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function suggestAiReplyAction(threadId: string): Promise<string> {
  const ctx = await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
  const messages = await getThreadMessages(threadId, ctx.organizationId);
  const transcript = messages
    .slice(-10)
    .map((m) => `${m.direction}: ${m.body}`)
    .join("\n");

  try {
    const result = await aiComplete({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: "VIRTUAL_SECRETARY",
      system:
        "Você é secretária virtual de clínica. Sugira resposta curta e cordial em PT-BR. Não dê orientação clínica.",
      userMessage: `Histórico:\n${transcript}\n\nSugira a próxima resposta da recepção:`,
      skipConsent: true,
    });
    return result.text.trim();
  } catch {
    return "Olá! Como posso ajudar?";
  }
}
