import { describe, expect, it, vi, beforeEach } from "vitest";
import { WhatsAppCloudAdapter } from "./whatsapp-cloud.adapter";

vi.mock("./whatsapp-delivery-log.service", () => ({
  logWhatsAppDelivery: vi.fn().mockResolvedValue(undefined),
}));

import { logWhatsAppDelivery } from "./whatsapp-delivery-log.service";

describe("WhatsAppCloudAdapter", () => {
  const fetchMock = vi.fn();
  const config = {
    phoneNumberId: "12345",
    accessToken: "token",
    graphVersion: "v22.0",
    defaultCountryCode: "55",
    templateLang: "pt_BR",
  };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(logWhatsAppDelivery).mockClear();
  });

  it("sends text message", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.123" }] }),
    });

    const adapter = new WhatsAppCloudAdapter(config);

    const result = await adapter.send({
      channel: "WHATSAPP",
      to: "11999998888",
      body: "Olá!",
      organizationId: "org1",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("wamid.123");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/12345/messages"),
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.to).toBe("5511999998888");
    expect(body.recipient_type).toBe("individual");
    expect(logWhatsAppDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org1", status: "sent" }),
    );
  });

  it("sends template when templateName provided", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.tpl" }] }),
    });

    const adapter = new WhatsAppCloudAdapter(config);

    const result = await adapter.send({
      channel: "WHATSAPP",
      to: "5511999998888",
      body: "fallback",
      templateName: "vital8_confirmacao",
      templateParams: ["Maria"],
      organizationId: "org1",
    });

    expect(result.success).toBe(true);
    expect(result.usedTemplate).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("vital8_confirmacao");
  });

  it("returns error and logs failed delivery", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "Invalid parameter" } }),
    });

    const adapter = new WhatsAppCloudAdapter(config);
    const result = await adapter.send({
      channel: "WHATSAPP",
      to: "5511999998888",
      body: "test",
      organizationId: "org1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid parameter");
    expect(logWhatsAppDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", detail: "Invalid parameter" }),
    );
  });

  it("rejects invalid phone", async () => {
    const adapter = new WhatsAppCloudAdapter(config);
    const result = await adapter.send({
      channel: "WHATSAPP",
      to: "123",
      body: "test",
    });

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
