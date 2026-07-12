import { MockPaymentsAdapter } from "./mock.adapter";
import type { PaymentsAdapter } from "./types";

let adapter: PaymentsAdapter | null = null;

export function getPaymentsAdapter(): PaymentsAdapter {
  if (!adapter) adapter = new MockPaymentsAdapter();
  return adapter;
}

export type { PaymentsAdapter, PaymentLinkInput, PaymentLinkResult } from "./types";
