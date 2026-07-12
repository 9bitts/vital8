import { describe, expect, it } from "vitest";
import {
  decryptPayload,
  deriveCacheKey,
  encryptPayload,
  generateSalt,
} from "./crypto.client";

describe("offline crypto", () => {
  it("criptografa e descriptografa payload com AES-GCM", async () => {
    const salt = generateSalt();
    const key = await deriveCacheKey("session-material-test", salt);
    const plain = JSON.stringify({ snapshot: { appointments: [] } });
    const cipher = await encryptPayload(key, plain);
    const decoded = await decryptPayload(key, cipher);
    expect(decoded).toBe(plain);
  });

  it("falha com chave diferente", async () => {
    const salt = generateSalt();
    const key1 = await deriveCacheKey("material-a", salt);
    const key2 = await deriveCacheKey("material-b", salt);
    const cipher = await encryptPayload(key1, "segredo");
    await expect(decryptPayload(key2, cipher)).rejects.toThrow();
  });
});
