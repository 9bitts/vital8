import { describe, expect, it } from "vitest";
import { avgDailyRates } from "./bi-anomaly.service";

describe("avgDailyRates", () => {
  it("computes average no-show and occupation", () => {
    const rates = avgDailyRates([
      {
        appointmentsNoShow: 2,
        appointmentsScheduled: 10,
        slotsAvailable: 20,
        slotsOccupied: 10,
        glosaCents: 1000,
      },
      {
        appointmentsNoShow: 0,
        appointmentsScheduled: 10,
        slotsAvailable: 20,
        slotsOccupied: 15,
        glosaCents: 500,
      },
    ]);

    expect(rates.noShowRate).toBeCloseTo(0.1);
    expect(rates.occupationRate).toBeCloseTo(0.625);
    expect(rates.avgGlosaCents).toBe(750);
  });
});
