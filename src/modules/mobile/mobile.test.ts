import { describe, expect, it } from "vitest";
import {
  deriveCacheKeyMaterial,
  verifyCacheKeyMaterial,
  SyncConflictError,
} from "@/modules/mobile/services/sync.service";

describe("mobile sync service", () => {
  it("deriva material de cache por usuário e org", () => {
    const a = deriveCacheKeyMaterial("user-1", "org-1");
    const b = deriveCacheKeyMaterial("user-1", "org-1");
    const c = deriveCacheKeyMaterial("user-2", "org-1");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("verifica material com timing-safe compare", () => {
    const material = deriveCacheKeyMaterial("u", "o");
    expect(verifyCacheKeyMaterial("u", "o", material)).toBe(true);
    expect(verifyCacheKeyMaterial("u", "o", "invalid")).toBe(false);
  });

  it("SyncConflictError carrega código", () => {
    const err = new SyncConflictError("SLOT_CONFLICT", "ocupado");
    expect(err.code).toBe("SLOT_CONFLICT");
    expect(err.message).toBe("ocupado");
  });
});
