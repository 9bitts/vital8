import { describe, it, expect } from "vitest";
import { encryptPHI, decryptPHI } from "@/lib/crypto/phi";

describe("PHI encryption", () => {
  it("roundtrips plaintext", () => {
    const plaintext = "Paciente João Silva — CPF 123.456.789-00";
    const encrypted = encryptPHI(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptPHI(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext for same plaintext", () => {
    const plaintext = "dado sensível";
    const a = encryptPHI(plaintext);
    const b = encryptPHI(plaintext);
    expect(a).not.toBe(b);
    expect(decryptPHI(a)).toBe(plaintext);
    expect(decryptPHI(b)).toBe(plaintext);
  });

  it("fails when auth tag is tampered", () => {
    const encrypted = encryptPHI("teste");
    const parts = encrypted.split(":");
    const tamperedTag = Buffer.from(parts[1], "base64");
    tamperedTag[0] ^= 0xff;
    parts[1] = tamperedTag.toString("base64");
    const tampered = parts.join(":");

    expect(() => decryptPHI(tampered)).toThrow();
  });

  it("fails with invalid format", () => {
    expect(() => decryptPHI("invalid")).toThrow("Formato de ciphertext inválido");
  });
});
