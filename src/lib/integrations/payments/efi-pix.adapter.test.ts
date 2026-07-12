import { describe, expect, it } from "vitest";
import { EfiPixAdapter } from "./efi-pix.adapter";

describe("EfiPixAdapter", () => {
  it("handleWebhook parses pix payment", async () => {
    const adapter = new EfiPixAdapter({
      clientId: "id",
      clientSecret: "secret",
      pixKey: "key@test",
      sandbox: true,
    });

    const result = await adapter.handleWebhook?.({
      pix: [{ txid: "abc123", valor: "150.00" }],
    });

    expect(result).toEqual({
      linkId: "",
      externalId: "abc123",
      status: "PAID",
      paidAmountCents: 15000,
    });
  });
});
