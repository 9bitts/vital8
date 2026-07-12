import type { TenantClient } from "@/lib/db/tenant-client";
import { updateReceivableStatus } from "./sale.service";

export async function processRefund(
  db: TenantClient,
  organizationId: string,
  userId: string,
  authorizedByUserId: string,
  input: {
    paymentId: string;
    amountCents: number;
    reason: string;
    cashRegisterId?: string | null;
  },
) {
  const payment = await db.payment.findFirstOrThrow({
    where: { id: input.paymentId },
    include: { receivable: true },
  });

  if (input.amountCents > payment.amountCents) {
    throw new Error("Estorno excede valor do pagamento");
  }

  const refund = await db.refund.create({
    data: {
      organizationId,
      paymentId: payment.id,
      amountCents: input.amountCents,
      reason: input.reason,
      authorizedByUserId,
      createdByUserId: userId,
    },
  });

  if (payment.receivableId && payment.receivable) {
    const recv = payment.receivable;
    const newPaid = Math.max(0, recv.paidCents - input.amountCents);
    await db.receivable.update({
      where: { id: recv.id },
      data: {
        paidCents: newPaid,
        status: newPaid <= 0 ? "ABERTO" : "PARCIAL",
      },
    });
    await updateReceivableStatus(db, recv.id);
  }

  if (input.cashRegisterId && payment.method === "DINHEIRO") {
    await db.cashRegisterEntry.create({
      data: {
        organizationId,
        cashRegisterId: input.cashRegisterId,
        entryType: "ESTORNO",
        amountCents: input.amountCents,
        paymentId: payment.id,
        reason: input.reason,
        createdByUserId: userId,
      },
    });
  }

  return refund;
}
