import { describe, expect, it } from "vitest";
import { computeTissBatchHash } from "./hash";

describe("computeTissBatchHash", () => {
  it("returns MD5 hex of xml content", () => {
    const xml = "<mensagemTISS>test</mensagemTISS>";
    const hash = computeTissBatchHash(xml);
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
    expect(hash).toBe(computeTissBatchHash(xml));
  });
});
