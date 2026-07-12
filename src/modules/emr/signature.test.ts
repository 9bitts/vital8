import { describe, expect, it } from "vitest";
import {
  computeDocumentContentHash,
  generateVerificationCode,
} from "@/modules/emr/services/clinical-signature.service";

describe("clinical signature helpers", () => {
  it("generates verification codes with V8 prefix", () => {
    const code = generateVerificationCode();
    expect(code.startsWith("V8-")).toBe(true);
    expect(code.length).toBeGreaterThan(6);
  });

  it("computes stable SHA-256 hash", () => {
    const h1 = computeDocumentContentHash('{"a":1}');
    const h2 = computeDocumentContentHash('{"a":1}');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });
});
