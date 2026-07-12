import { describe, it, expect } from "vitest";
import {
  canViewClinicalContent,
  canViewRestrictedSection,
  isFinanceBlocked,
} from "@/modules/emr/lib/permissions";

describe("EMR permissions", () => {
  it("FINANCEIRO não acessa conteúdo clínico", () => {
    expect(isFinanceBlocked("FINANCEIRO")).toBe(true);
    expect(canViewClinicalContent("FINANCEIRO")).toBe(false);
  });

  it("RECEPCAO não acessa conteúdo clínico", () => {
    expect(canViewClinicalContent("RECEPCAO")).toBe(false);
  });

  it("PROFISSIONAL acessa conteúdo clínico", () => {
    expect(canViewClinicalContent("PROFISSIONAL_SAUDE")).toBe(true);
  });

  it("registro reservado oculto para não-autor inclusive OWNER", () => {
    expect(
      canViewRestrictedSection(true, "author-1", "owner-2", "OWNER"),
    ).toBe(false);
    expect(
      canViewRestrictedSection(true, "author-1", "author-1", "PROFISSIONAL_SAUDE"),
    ).toBe(true);
  });
});
