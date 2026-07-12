import { describe, expect, it } from "vitest";
import { parseLacunaError } from "./lacuna-errors";

describe("parseLacunaError", () => {
  it("detecta quota", () => {
    expect(parseLacunaError(new Error("quota exceeded"))).toBe("LACUNA_QUOTA");
  });

  it("detecta cpf", () => {
    expect(parseLacunaError(new Error("invalid cpf for certificate"))).toBe(
      "LACUNA_CPF",
    );
  });

  it("fallback unavailable", () => {
    expect(parseLacunaError(new Error("network timeout"))).toBe(
      "LACUNA_UNAVAILABLE",
    );
  });
});
