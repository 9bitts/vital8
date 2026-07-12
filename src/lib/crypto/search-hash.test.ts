import { describe, it, expect } from "vitest";
import {
  hashCpf,
  isValidCpf,
  normalizeSearchName,
  normalizePhone,
  calculateAge,
} from "@/lib/crypto/search-hash";

const ORG = "org-test-1";

describe("search-hash utilities", () => {
  it("valida CPF correto", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  it("rejeita CPF inválido", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("gera HMAC determinístico por organização", () => {
    const a = hashCpf("529.982.247-25", ORG);
    const b = hashCpf("52998224725", ORG);
    const c = hashCpf("52998224725", "org-test-2");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });

  it("normaliza nome para busca", () => {
    expect(normalizeSearchName("  João   da Silva  ")).toBe("joao da silva");
    expect(normalizeSearchName("José")).toBe("jose");
  });

  it("normaliza telefone", () => {
    expect(normalizePhone("(11) 99999-8888")).toBe("11999998888");
  });

  it("calcula idade", () => {
    const birth = new Date();
    birth.setFullYear(birth.getFullYear() - 30);
    expect(calculateAge(birth)).toBe(30);
  });
});
