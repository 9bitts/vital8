import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/db/admin-client", () => ({
  adminPrisma: {
    dailyOrgMetrics: { upsert: mocks.upsertMock, findMany: mocks.findManyMock },
    professional: { findMany: vi.fn().mockResolvedValue([]) },
    appointment: { findMany: vi.fn().mockResolvedValue([]) },
    scheduleTemplate: { findMany: vi.fn().mockResolvedValue([]) },
    holiday: { findFirst: vi.fn().mockResolvedValue(null) },
    patient: { count: vi.fn().mockResolvedValue(0) },
    payment: { findMany: vi.fn().mockResolvedValue([]) },
    sale: { findMany: vi.fn().mockResolvedValue([]) },
    payable: { findMany: vi.fn().mockResolvedValue([]) },
    npsResponse: { findMany: vi.fn().mockResolvedValue([]) },
    receivable: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCents: 0, paidCents: 0 } }) },
    stockMovement: { findMany: vi.fn().mockResolvedValue([]) },
    stockBalance: { findMany: vi.fn().mockResolvedValue([]) },
    dailyProfessionalMetrics: { upsert: vi.fn() },
  },
}));

import { upsertOrgDayMetrics } from "./services/aggregation.service";

describe("aggregation idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertMock.mockResolvedValue({ id: "1" });
  });

  it("upserts same day twice via upsert", async () => {
    await upsertOrgDayMetrics("org-a", "2026-07-01");
    await upsertOrgDayMetrics("org-a", "2026-07-01");
    expect(mocks.upsertMock).toHaveBeenCalledTimes(2);
    expect(mocks.upsertMock.mock.calls[0]![0].where.organizationId_date.organizationId).toBe("org-a");
  });
});

describe("tenant isolation", () => {
  it("aggregated query scoped by org", async () => {
    mocks.findManyMock.mockResolvedValue([{ appointmentsCompleted: 5, revenueReceivedCents: 1000 }]);
    const { sumAggregatedOrgTotals } = await import("./services/aggregation.service");
    const totals = await sumAggregatedOrgTotals("org-a", new Date("2026-07-01"), new Date("2026-07-31"));
    expect(totals.appointmentsCompleted).toBe(5);
    expect(mocks.findManyMock.mock.calls[0]![0].where.organizationId).toBe("org-a");
  });
});
