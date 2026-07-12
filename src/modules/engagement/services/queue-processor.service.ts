import type { CommunicationOrigin } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";
import { decryptPHI } from "@/lib/crypto/phi";
import { getMessagingAdapter } from "@/lib/integrations/messaging";
import { normalizeWhatsAppPhone } from "@/lib/integrations/messaging/whatsapp-phone";
import { isOptedOut } from "./opt-out.service";
import { marketingFooter } from "../lib/template-renderer";

const MAX_RETRIES = 3;
const BACKOFF_MS = [60_000, 300_000, 900_000];

function extractContactPhone(phonesEncrypted: string): string {
  const raw = decryptPHI(phonesEncrypted);
  let digits = "";
  try {
    const parsed = JSON.parse(raw) as Array<{ number?: string }> | string;
    if (Array.isArray(parsed)) {
      digits = String(parsed[0]?.number ?? "");
    } else {
      digits = raw;
    }
  } catch {
    digits = raw;
  }
  return normalizeWhatsAppPhone(digits) ?? digits.replace(/\D/g, "").slice(0, 15);
}

function isMarketingOrigin(origin: CommunicationOrigin): boolean {
  return origin === "CAMPANHA" || origin === "ANIVERSARIO";
}

export async function processCommunicationQueue(limit = 50): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const now = new Date();
  const pending = await adminPrisma.communicationLog.findMany({
    where: {
      status: "FILA",
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      patient: { select: { fullName: true, phonesEncrypted: true, emailEncrypted: true } },
      template: true,
    },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const messaging = getMessagingAdapter();

  for (const log of pending) {
    const claimed = await adminPrisma.communicationLog.updateMany({
      where: { id: log.id, status: "FILA" },
      data: { status: "ENVIADO", sentAt: now },
    });
    if (claimed.count === 0) {
      skipped += 1;
      continue;
    }

    const marketing = isMarketingOrigin(log.origin);
    const purpose = marketing ? "MARKETING" : "TRANSACIONAL";
    if (await isOptedOut(log.organizationId, log.patientId, log.channel, purpose)) {
      await adminPrisma.communicationLog.update({
        where: { id: log.id },
        data: {
          status: "FALHA",
          failReason: "Paciente opt-out",
        },
      });
      skipped += 1;
      continue;
    }

    let to = "";
    if (log.channel === "EMAIL") {
      to = log.patient.emailEncrypted
        ? decryptPHI(log.patient.emailEncrypted)
        : "";
    } else {
      to = log.patient.phonesEncrypted
        ? extractContactPhone(log.patient.phonesEncrypted)
        : "";
    }
    if (!to) {
      await adminPrisma.communicationLog.update({
        where: { id: log.id },
        data: { status: "FALHA", failReason: "Contato indisponível" },
      });
      failed += 1;
      continue;
    }

    let body = log.renderedBody;
    if (marketing) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      body += marketingFooter(
        `${baseUrl}/portal/opt-out?patient=${log.patientId}&org=${log.organizationId}`,
      );
    }

    const useWhatsAppTemplate = log.channel === "WHATSAPP" && !marketing;

    const result = await messaging.send({
      channel: log.channel,
      to,
      subject: log.subject ?? undefined,
      body,
      organizationId: log.organizationId,
      communicationOrigin: useWhatsAppTemplate ? log.origin : undefined,
      templateLanguage: "pt_BR",
      templateParams: useWhatsAppTemplate ? [log.patient.fullName] : undefined,
      metadata: { communicationLogId: log.id },
    });

    if (result.messageId) {
      const prevMeta =
        typeof log.metadata === "object" && log.metadata !== null
          ? (log.metadata as Record<string, unknown>)
          : {};
      await adminPrisma.communicationLog.update({
        where: { id: log.id },
        data: {
          metadata: { ...prevMeta, whatsappMessageId: result.messageId },
        },
      });
    }

    if (!result.success) {
      const retry = log.retryCount + 1;
      if (retry >= MAX_RETRIES) {
        await adminPrisma.communicationLog.update({
          where: { id: log.id },
          data: {
            status: "FALHA",
            failReason: result.error ?? "Falha no envio",
            retryCount: retry,
          },
        });
        failed += 1;
      } else {
        const backoff = BACKOFF_MS[retry - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!;
        await adminPrisma.communicationLog.update({
          where: { id: log.id },
          data: {
            status: "FILA",
            sentAt: null,
            retryCount: retry,
            scheduledFor: new Date(Date.now() + backoff),
            failReason: result.error ?? "Retry agendado",
          },
        });
        failed += 1;
      }
      continue;
    }

    sent += 1;
  }

  return { processed: pending.length, sent, failed, skipped };
}

export async function retryCommunication(logId: string, organizationId: string) {
  return adminPrisma.communicationLog.updateMany({
    where: { id: logId, organizationId, status: "FALHA" },
    data: {
      status: "FILA",
      retryCount: 0,
      failReason: null,
      scheduledFor: new Date(),
      sentAt: null,
    },
  });
}
