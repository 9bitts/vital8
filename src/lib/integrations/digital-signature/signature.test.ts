import { describe, expect, it } from "vitest";
import { embedPadesSignatureBlock } from "./pades";
import { DevSimpleSignatureAdapter } from "./dev-simple.adapter";
import { A1SignatureAdapter } from "./a1.adapter";
import { requestActTimestamp } from "./timestamp";

describe("digital-signature adapters", () => {
  const baseInput = {
    userId: "u1",
    userName: "Dr. Ana",
    contentHash: "abc123hash",
    entityType: "ENCOUNTER",
    entityId: "enc1",
    timestamp: new Date("2026-01-15T10:00:00Z"),
  };

  it("dev-simple signs without certificate", async () => {
    const adapter = new DevSimpleSignatureAdapter();
    const result = await adapter.sign(baseInput);
    expect(result.method).toBe("DEV_SIMPLE");
    expect(result.metadata.contentHash).toBe("abc123hash");
  });

  it("A1 requires certificate", async () => {
    const adapter = new A1SignatureAdapter();
    await expect(adapter.sign(baseInput)).rejects.toThrow("Certificado A1");
  });

  it("A1 signs with certificate and CAdES metadata", async () => {
    const adapter = new A1SignatureAdapter();
    const result = await adapter.sign({
      ...baseInput,
      certificatePfxBase64: Buffer.from("fake-pfx").toString("base64"),
      certificatePassword: "secret",
    });
    expect(result.method).toBe("ICP_A1");
    expect(result.metadata.cadesDetached).toBeTruthy();
    expect(result.padesBlock).toContain("ICP-A1:");
  });

  it("ACT timestamp mock returns token", async () => {
    const token = await requestActTimestamp("hash123");
    expect(token).toMatch(/^ACT:/);
  });
});

describe("PAdES block", () => {
  it("embeds signature metadata in PDF", () => {
    const pdf = Buffer.from("%PDF-1.4\n%%EOF", "utf8");
    const signed = embedPadesSignatureBlock(pdf, {
      verificationCode: "V8-ABCD1234",
      contentHash: "deadbeef",
      signerName: "Dr. Ana",
      signedAt: new Date("2026-01-15"),
      method: "ICP_A1",
      timestampToken: "ACT:token",
    });
    const text = signed.toString("utf8");
    expect(text).toContain("V8-ABCD1234");
    expect(text).toContain("deadbeef");
    expect(text).toContain("EndSignature");
  });
});
