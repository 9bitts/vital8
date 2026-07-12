import { describe, expect, it } from "vitest";
import { getDailyReadiness } from "./daily-readiness";

describe("getDailyReadiness", () => {
  it("reports jitsi fallback when no api key", () => {
    const prev = process.env.DAILY_API_KEY;
    delete process.env.DAILY_API_KEY;
    const r = getDailyReadiness();
    expect(r.configured).toBe(false);
    expect(r.note).toContain("Jitsi");
    if (prev) process.env.DAILY_API_KEY = prev;
  });

  it("reports production when key and webhook secret exist", () => {
    const prevKey = process.env.DAILY_API_KEY;
    const prevSecret = process.env.DAILY_WEBHOOK_SECRET;
    process.env.DAILY_API_KEY = "key";
    process.env.DAILY_WEBHOOK_SECRET = "c2VjcmV0";
    const r = getDailyReadiness();
    expect(r.configured).toBe(true);
    expect(r.productionReady).toBe(true);
    if (prevKey) process.env.DAILY_API_KEY = prevKey;
    else delete process.env.DAILY_API_KEY;
    if (prevSecret) process.env.DAILY_WEBHOOK_SECRET = prevSecret;
    else delete process.env.DAILY_WEBHOOK_SECRET;
  });
});
