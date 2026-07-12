import { NextRequest, NextResponse } from "next/server";
import { adminPrisma } from "@/lib/db/admin-client";
import { logWhatsAppDelivery } from "@/lib/integrations/messaging/whatsapp-delivery-log.service";
import { verifyWhatsAppWebhookSignature } from "@/lib/integrations/messaging/whatsapp-webhook";
import { handleInboundWhatsApp } from "@/modules/engagement/services/conversation.service";

export const dynamic = "force-dynamic";

function verifyWebhookGet(request: Request): boolean {
  const token = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== "production";
  const url = new URL(request.url);
  return url.searchParams.get("hub.verify_token") === token;
}

async function resolveOrganizationId(
  phoneNumberId: string | undefined,
): Promise<string | null> {
  if (phoneNumberId) {
    const org = await adminPrisma.messagingSettings.findFirst({
      where: { whatsappPhoneNumberId: phoneNumberId },
      select: { organizationId: true },
    });
    if (org) return org.organizationId;
  }

  const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (envPhoneId && phoneNumberId === envPhoneId) {
    const first = await adminPrisma.organization.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return first?.id ?? null;
  }

  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && verifyWebhookGet(request) && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWhatsAppWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let payload: { entry?: Array<Record<string, unknown>> };
  try {
    payload = JSON.parse(rawBody) as { entry?: Array<Record<string, unknown>> };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entries = payload.entry ?? [];

  for (const entry of entries) {
    const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];
    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined;
      if (!value) continue;

      const phoneNumberId = (value.metadata as { phone_number_id?: string })
        ?.phone_number_id;
      const organizationId = await resolveOrganizationId(phoneNumberId);
      if (!organizationId) continue;

      const statuses = (value.statuses as Array<Record<string, unknown>>) ?? [];
      for (const st of statuses) {
        const logId = String(st.id ?? "");
        const status = String(st.status ?? "unknown");
        const recipientId = st.recipient_id as string | undefined;
        const detail = (
          st.errors as Array<{ title?: string }> | undefined
        )?.[0]?.title;

        await logWhatsAppDelivery({
          organizationId,
          messageId: logId || undefined,
          phone: recipientId,
          status,
          detail,
        });

        if (logId && status === "failed") {
          await adminPrisma.communicationLog.updateMany({
            where: {
              organizationId,
              metadata: { path: ["whatsappMessageId"], equals: logId },
            },
            data: {
              status: "FALHA",
              failReason: detail ?? "WhatsApp delivery failed",
            },
          });
        }
      }

      const messages = (value.messages as Array<Record<string, unknown>>) ?? [];
      for (const msg of messages) {
        const from = String(msg.from ?? "");
        const messageId = String(msg.id ?? "");
        const text = (msg.text as { body?: string })?.body ?? "";
        const button = (msg.button as { payload?: string })?.payload;
        const interactive = (
          msg.interactive as { button_reply?: { id?: string } }
        )?.button_reply?.id;

        await handleInboundWhatsApp({
          organizationId,
          from,
          messageId,
          body: text,
          buttonPayload: button ?? interactive,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
