import { adminPrisma } from "@/lib/db/admin-client";

function maskPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/\d(?=\d{4})/g, "*");
}

export async function logWhatsAppDelivery(params: {
  organizationId: string;
  messageId?: string;
  phone?: string;
  template?: string;
  status: string;
  detail?: string;
}): Promise<void> {
  try {
    await adminPrisma.whatsAppDeliveryLog.create({
      data: {
        organizationId: params.organizationId,
        messageId: params.messageId,
        phone: maskPhone(params.phone),
        template: params.template,
        status: params.status,
        detail: params.detail?.slice(0, 500),
      },
    });
  } catch (e) {
    console.error("[WHATSAPP LOG]", e);
  }
}
