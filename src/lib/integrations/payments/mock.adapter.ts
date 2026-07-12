import { randomUUID } from "crypto";
import type {
  PaymentLinkInput,
  PaymentLinkResult,
  PaymentsAdapter,
} from "./types";

const links = new Map<string, PaymentLinkResult>();

export class MockPaymentsAdapter implements PaymentsAdapter {
  async createLink(input: PaymentLinkInput): Promise<PaymentLinkResult> {
    const linkId = randomUUID();
    const result: PaymentLinkResult = {
      linkId,
      url: `/pagamento/${linkId}`,
      pixCopyPaste: `00020126580014BR.GOV.BCB.PIX0136${linkId}5204000053039865802BR5913Vital8 Mock6009SAO PAULO62070503***6304ABCD`,
      status: "PENDING",
      externalId: linkId,
    };
    links.set(linkId, result);
    console.log(
      `[Vital8 Payments] Link ${result.url} — R$ ${(input.amountCents / 100).toFixed(2)} — ${input.description}`,
    );
    return result;
  }

  async getStatus(linkId: string): Promise<PaymentLinkResult["status"]> {
    return links.get(linkId)?.status ?? "EXPIRED";
  }
}
