import { adminPrisma } from "@/lib/db/admin-client";
import { isStripeConfigured } from "@/lib/integrations/billing/stripe-client";
import {
  isStripeEventProcessed,
  markStripeEventProcessed,
} from "@/lib/integrations/billing/processed-stripe-event.service";
import { MockPaymentsAdapter } from "./mock.adapter";
import { EfiPixAdapter } from "./efi-pix.adapter";
import { StripePaymentsAdapter } from "./stripe.adapter";
import type {
  PaymentLinkInput,
  PaymentLinkResult,
  PaymentWebhookResult,
  PaymentsAdapter,
} from "./types";

class PersistentPaymentsAdapter implements PaymentsAdapter {
  private inner: PaymentsAdapter;

  constructor(inner: PaymentsAdapter) {
    this.inner = inner;
  }

  async createLink(input: PaymentLinkInput): Promise<PaymentLinkResult> {
    const result = await this.inner.createLink(input);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await adminPrisma.patientPaymentLink.create({
      data: {
        id: result.linkId,
        organizationId: input.organizationId,
        patientId: input.patientId ?? null,
        receivableId: input.receivableId ?? null,
        externalId: result.externalId ?? null,
        amountCents: input.amountCents,
        description: input.description,
        pixCopyPaste: result.pixCopyPaste,
        pixQrCodeBase64: result.pixQrCodeBase64 ?? null,
        status: "PENDING",
        expiresAt,
      },
    });

    return result;
  }

  async getStatus(linkId: string): Promise<PaymentLinkResult["status"]> {
    const row = await adminPrisma.patientPaymentLink.findFirst({
      where: { id: linkId },
    });
    if (!row) return "EXPIRED";
    if (row.status === "PAID") return "PAID";
    if (row.expiresAt && row.expiresAt < new Date()) return "EXPIRED";
    return "PENDING";
  }

  async handleWebhook(
    payload: unknown,
    options?: { signature?: string | null; rawBody?: string },
  ): Promise<PaymentWebhookResult | null> {
    if (!this.inner.handleWebhook) return null;
    return this.inner.handleWebhook(payload, options);
  }
}

function buildInnerAdapter(): PaymentsAdapter {
  if (isStripeConfigured()) {
    return new StripePaymentsAdapter();
  }

  const clientId = process.env.EFI_CLIENT_ID;
  const clientSecret = process.env.EFI_CLIENT_SECRET;
  const pixKey = process.env.EFI_PIX_KEY;

  if (clientId && clientSecret && pixKey) {
    return new EfiPixAdapter({
      clientId,
      clientSecret,
      pixKey,
      sandbox: process.env.EFI_SANDBOX !== "false",
    });
  }

  return new MockPaymentsAdapter();
}

let adapter: PaymentsAdapter | null = null;

export function getPaymentsAdapter(): PaymentsAdapter {
  if (!adapter) {
    adapter = new PersistentPaymentsAdapter(buildInnerAdapter());
  }
  return adapter;
}

export async function getPaymentLinkDetails(linkId: string) {
  return adminPrisma.patientPaymentLink.findFirst({
    where: { id: linkId },
    include: {
      patient: { select: { fullName: true, socialName: true } },
      receivable: { select: { description: true, totalCents: true, paidCents: true } },
    },
  });
}

export async function reconcilePaymentWebhook(result: PaymentWebhookResult) {
  if (result.stripeEventId && (await isStripeEventProcessed(result.stripeEventId))) {
    const link = await adminPrisma.patientPaymentLink.findFirst({
      where: { id: result.linkId },
    });
    return link;
  }

  const link = result.externalId
    ? await adminPrisma.patientPaymentLink.findFirst({
        where: { externalId: result.externalId },
      })
    : result.linkId
      ? await adminPrisma.patientPaymentLink.findFirst({
          where: { id: result.linkId },
        })
      : null;

  if (!link || link.status === "PAID") {
    if (result.stripeEventId) {
      await markStripeEventProcessed({
        eventId: result.stripeEventId,
        type: "checkout.session.completed",
        organizationId: link?.organizationId,
      });
    }
    return link;
  }

  if (result.status !== "PAID") {
    await adminPrisma.patientPaymentLink.update({
      where: { id: link.id },
      data: { status: result.status === "EXPIRED" ? "EXPIRED" : "CANCELLED" },
    });
    if (result.stripeEventId) {
      await markStripeEventProcessed({
        eventId: result.stripeEventId,
        type: "checkout.session.expired",
        organizationId: link.organizationId,
      });
    }
    return link;
  }

  const amount = result.paidAmountCents ?? link.amountCents;

  await adminPrisma.$transaction(async (tx) => {
    await tx.patientPaymentLink.update({
      where: { id: link.id },
      data: { status: "PAID", paidAt: new Date() },
    });

    if (link.receivableId) {
      const recv = await tx.receivable.findFirstOrThrow({
        where: { id: link.receivableId },
      });
      const newPaid = recv.paidCents + amount;
      const status =
        newPaid >= recv.totalCents ? "PAGO" : newPaid > 0 ? "PARCIAL" : "ABERTO";
      await tx.receivable.update({
        where: { id: recv.id },
        data: {
          paidCents: newPaid,
          status,
        },
      });

      if (link.patientId) {
        const owner = await tx.membership.findFirst({
          where: { organizationId: link.organizationId, role: "OWNER", deletedAt: null },
          select: { userId: true },
        });
        if (!owner) return;

        await tx.payment.create({
          data: {
            organizationId: link.organizationId,
            patientId: link.patientId,
            receivableId: link.receivableId,
            amountCents: amount,
            netAmountCents: amount,
            method: "LINK",
            createdByUserId: owner.userId,
            notes: `Link ${link.externalId ? "Stripe" : "PIX"} ${link.id}`,
          },
        });
      }
    }
  });

  if (result.stripeEventId) {
    await markStripeEventProcessed({
      eventId: result.stripeEventId,
      type: "checkout.session.completed",
      organizationId: link.organizationId,
    });
  }

  return link;
}

export type { PaymentsAdapter, PaymentLinkInput, PaymentLinkResult } from "./types";
