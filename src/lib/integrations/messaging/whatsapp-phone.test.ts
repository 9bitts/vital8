import { describe, expect, it } from "vitest";
import { normalizeWhatsAppPhone, waPhoneDigits } from "./whatsapp-phone";

describe("whatsapp-phone", () => {
  it("normaliza celular BR sem DDI", () => {
    expect(normalizeWhatsAppPhone("11999998888")).toBe("5511999998888");
  });

  it("mantém número internacional completo", () => {
    expect(normalizeWhatsAppPhone("5511999998888")).toBe("5511999998888");
  });

  it("rejeita número curto", () => {
    expect(normalizeWhatsAppPhone("123")).toBeNull();
  });

  it("waPhoneDigits usa país informado", () => {
    expect(waPhoneDigits("2025551212", "US")).toBe("12025551212");
  });
});
