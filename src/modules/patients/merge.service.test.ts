import { describe, it, expect } from "vitest";
import { hashCpf } from "@/lib/crypto/search-hash";

describe("merge cpf hash consistency", () => {
  const orgId = "org-merge-test";

  it("cpfHash é estável para mesclagem", () => {
    const hash1 = hashCpf("52998224725", orgId);
    const hash2 = hashCpf("529.982.247-25", orgId);
    expect(hash1).toBe(hash2);
  });

  it("cpfHash difere entre organizações", () => {
    const a = hashCpf("52998224725", "org-a");
    const b = hashCpf("52998224725", "org-b");
    expect(a).not.toBe(b);
  });
});
