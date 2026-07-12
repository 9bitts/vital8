import { describe, expect, it } from "vitest";
import {
  SUBSCRIPTION_PLAN_LIMITS,
  subscriptionPlanToOrgPlan,
  isSubscriptionReadOnly,
} from "@/lib/features/subscription-plans";

describe("subscription plans", () => {
  it("maps BASICO to STARTER org plan", () => {
    expect(subscriptionPlanToOrgPlan("BASICO")).toBe("STARTER");
    expect(subscriptionPlanToOrgPlan("PRO")).toBe("PRO");
  });

  it("ENTERPRISE has more branches than BASICO", () => {
    expect(SUBSCRIPTION_PLAN_LIMITS.ENTERPRISE.maxBranches).toBeGreaterThan(
      SUBSCRIPTION_PLAN_LIMITS.BASICO.maxBranches,
    );
  });

  it("read-only after grace period", () => {
    const past = new Date(Date.now() - 86400000);
    expect(isSubscriptionReadOnly("INADIMPLENTE", past)).toBe(true);
    expect(isSubscriptionReadOnly("ATIVA", null)).toBe(false);
  });
});
