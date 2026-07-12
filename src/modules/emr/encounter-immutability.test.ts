import { describe, it, expect } from "vitest";
import {
  assertEncounterMutable,
  EncounterImmutableError,
} from "@/modules/emr/services/encounter.service";

describe("encounter immutability", () => {
  it("permite mutação em RASCUNHO", () => {
    expect(() => assertEncounterMutable("RASCUNHO")).not.toThrow();
  });

  it("bloqueia mutação em ASSINADO", () => {
    expect(() => assertEncounterMutable("ASSINADO")).toThrow(
      EncounterImmutableError,
    );
  });
});
