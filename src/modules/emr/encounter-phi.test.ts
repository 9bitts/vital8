import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { encryptPHI, decryptPHI } from "@/lib/crypto/phi";

describe("EMR section PHI encryption", () => {
  const originalKey = process.env.PHI_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.PHI_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  afterAll(() => {
    process.env.PHI_ENCRYPTION_KEY = originalKey;
  });

  it("criptografa e descriptografa conteúdo clínico", () => {
    const plain = "Evolução: paciente estável, sem intercorrências.";
    const encrypted = encryptPHI(plain);
    expect(encrypted).not.toContain("paciente");
    expect(decryptPHI(encrypted)).toBe(plain);
  });
});
