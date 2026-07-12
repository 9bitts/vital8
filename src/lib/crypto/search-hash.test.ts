import { describe, it, expect } from "vitest";
import {
  hashCpf,
  isValidCpf,
  normalizeSearchName,
  normalizePhone,
} from "@/lib/crypto/search-hash";

describe("search-hash utilities", () => {
  it("valida CPF correto", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  it("rejeita CPF inválido", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("gera hash determinístico para CPF", () => {
    const a = hashCpf("529.982.247-25");
    const b = hashCpf("52998224725");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("normaliza nome para busca", () => {
    expect(normalizeSearchName("  João   da Silva  ")).toBe("joao da silva");
    expect(normalizeSearchName("José")).toBe("jose");
  });

  it("normaliza telefone", () => {
    expect(normalizePhone("(11) 99999-8888")).toBe("11999998888");
  });
});
