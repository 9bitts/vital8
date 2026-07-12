import { describe, it, expect } from "vitest";
import {
  buildCanonicalEncounter,
  computeEncounterContentHash,
} from "@/modules/emr/services/integrity.service";

describe("encounter content hash", () => {
  it("produz hash SHA-256 determinístico", () => {
    const payload = buildCanonicalEncounter({
      encounter: {
        id: "enc-1",
        patientId: "pat-1",
        professionalId: "prof-1",
        modality: "PRESENCIAL",
        specialty: "medicina_geral",
        startedAt: new Date("2026-07-01T10:00:00Z"),
        endedAt: new Date("2026-07-01T10:30:00Z"),
      },
      sections: [
        {
          id: "s1",
          sectionType: "ANAMNESE",
          structuredData: {},
          contentPlain: "Paciente refere dor de garganta",
          restrictedToAuthor: false,
          sortOrder: 0,
        },
      ],
      amendments: [],
    });

    const h1 = computeEncounterContentHash(payload);
    const h2 = computeEncounterContentHash(payload);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hash muda quando conteúdo muda", () => {
    const base = buildCanonicalEncounter({
      encounter: {
        id: "enc-1",
        patientId: "pat-1",
        professionalId: "prof-1",
        modality: "PRESENCIAL",
        startedAt: new Date("2026-07-01T10:00:00Z"),
      },
      sections: [
        {
          id: "s1",
          sectionType: "ANAMNESE",
          structuredData: {},
          contentPlain: "Texto A",
          restrictedToAuthor: false,
          sortOrder: 0,
        },
      ],
      amendments: [],
    });

    const altered = buildCanonicalEncounter({
      encounter: {
        id: "enc-1",
        patientId: "pat-1",
        professionalId: "prof-1",
        modality: "PRESENCIAL",
        startedAt: new Date("2026-07-01T10:00:00Z"),
      },
      sections: [
        {
          id: "s1",
          sectionType: "ANAMNESE",
          structuredData: {},
          contentPlain: "Texto B",
          restrictedToAuthor: false,
          sortOrder: 0,
        },
      ],
      amendments: [],
    });

    expect(computeEncounterContentHash(base)).not.toBe(
      computeEncounterContentHash(altered),
    );
  });
});
