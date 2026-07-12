import type { TenantClient } from "@/lib/db/tenant-client";
import { getMessagingAdapter } from "@/lib/integrations/messaging";
import { formatBRL } from "@/lib/money";

export async function sendOverdueReminders(
  db: TenantClient,
  organizationId: string,
  orgName: string,
  config: { dayOffsets: number[] } = { dayOffsets: [1, 7] },
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue = await db.receivable.findMany({
    where: {
      status: { in: ["ABERTO", "PARCIAL", "VENCIDO"] },
      optOutReminders: false,
      dueDate: { lt: today },
    },
    include: { patient: true },
  });

  const messaging = getMessagingAdapter();
  let sent = 0;

  for (const recv of overdue) {
    const daysOverdue = Math.floor(
      (today.getTime() - new Date(recv.dueDate).getTime()) / 86400000,
    );

    if (!config.dayOffsets.includes(daysOverdue)) continue;

    const phone = recv.patient.phoneSearch;
    if (!phone) continue;

    await messaging.send({
      to: phone,
      channel: "SMS",
      body: `${orgName}: pendência de ${formatBRL(recv.totalCents - recv.paidCents)} vencida em ${new Date(recv.dueDate).toLocaleDateString("pt-BR")}.`,
      organizationId,
    });

    await db.receivable.update({
      where: { id: recv.id },
      data: { reminderSentAt: new Date(), status: "VENCIDO" },
    });
    sent++;
  }

  return { sent };
}
