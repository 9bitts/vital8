import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/admin-client", () => ({
  adminPrisma: {
    communicationLog: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    patientOptOut: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/integrations/messaging", () => ({
  getMessagingAdapter: () => ({
    send: vi.fn().mockResolvedValue({ success: true, messageId: "1" }),
  }),
}));

import { adminPrisma } from "@/lib/db/admin-client";
import { processCommunicationQueue } from "./services/queue-processor.service";

describe("queue idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não reenvia se updateMany claim falhar", async () => {
    vi.mocked(adminPrisma.communicationLog.findMany).mockResolvedValue([
      {
        id: "log1",
        organizationId: "org1",
        patientId: "p1",
        channel: "WHATSAPP",
        renderedBody: "test",
        origin: "CONFIRMACAO",
        retryCount: 0,
        patient: { fullName: "Ana", phonesEncrypted: null, emailEncrypted: null },
        template: null,
      },
    ] as never);
    vi.mocked(adminPrisma.communicationLog.updateMany).mockResolvedValue({ count: 0 });

    const result = await processCommunicationQueue();
    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
  });
});
