import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-sns", () => {
  class MockSNSClient {
    send = sendMock;
  }
  class MockPublishCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    SNSClient: MockSNSClient,
    PublishCommand: MockPublishCommand,
  };
});

import {
  SnsSmsAdapter,
  isAwsSnsConfigured,
  isAwsSnsProductionReady,
} from "./sns-sms.adapter";

describe("SnsSmsAdapter", () => {
  beforeEach(() => {
    sendMock.mockReset();
    delete process.env.E2E_MOCK_SNS;
    process.env.AWS_SNS_SMS_ENABLED = "1";
    process.env.AWS_ACCESS_KEY_ID = "AKIATEST";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    process.env.AWS_SNS_SMS_PRODUCTION = "0";
  });

  it("detects SNS configuration", () => {
    expect(isAwsSnsConfigured()).toBe(true);
    expect(isAwsSnsProductionReady()).toBe(false);
    process.env.AWS_SNS_SMS_PRODUCTION = "1";
    expect(isAwsSnsProductionReady()).toBe(true);
  });

  it("rejects non-SMS channel", async () => {
    const adapter = new SnsSmsAdapter();
    const result = await adapter.send({
      channel: "EMAIL",
      to: "a@b.com",
      body: "hi",
    });
    expect(result.success).toBe(false);
  });

  it("sends SMS with normalized phone", async () => {
    sendMock.mockResolvedValue({ MessageId: "sms-123" });
    const adapter = new SnsSmsAdapter();

    const result = await adapter.send({
      channel: "SMS",
      to: "11999998888",
      body: "Consulta confirmada",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("sms-123");
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("uses e2e mock when enabled", async () => {
    process.env.E2E_MOCK_SNS = "1";
    const adapter = new SnsSmsAdapter();
    const result = await adapter.send({
      channel: "SMS",
      to: "5511999998888",
      body: "test",
    });
    expect(result.messageId).toBe("e2e-mock-sms");
    expect(sendMock).not.toHaveBeenCalled();
  });
});
