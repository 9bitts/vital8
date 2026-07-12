import { describe, expect, it } from "vitest";
import {
  getVital8PlanPriceId,
  getSubscriptionPaymentMethodTypes,
} from "./stripe-payment-methods";

describe("stripe-payment-methods", () => {
  it("retorna card+boleto para BRL", () => {
    expect(getSubscriptionPaymentMethodTypes("brl")).toEqual(["card", "boleto"]);
  });

  it("resolve price id por env", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_123";
    expect(getVital8PlanPriceId("PRO", "MONTHLY")).toBe("price_123");
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
  });
});
