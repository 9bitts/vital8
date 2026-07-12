import { describe, it, expect } from "vitest";
import { isValidCnpj, stripCnpj } from "./cnpj";

describe("isValidCnpj", () => {
  it("validates known valid CNPJ", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj(stripCnpj("11.222.333/0001-81"))).toBe(true);
  });

  it("rejects invalid check digits", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
  });

  it("rejects repeated digits", () => {
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
  });
});
