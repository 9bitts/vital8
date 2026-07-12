import { createHash } from "crypto";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`;
}

export type CanonicalSection = {
  id: string;
  sectionType: string;
  structuredData: unknown;
  contentPlain?: string | null;
  restrictedToAuthor: boolean;
  sortOrder: number;
};

export type CanonicalEncounter = {
  id: string;
  patientId: string;
  professionalId: string;
  modality: string;
  specialty?: string | null;
  startedAt: string;
  endedAt?: string | null;
  sections: CanonicalSection[];
  amendments: { id: string; createdAt: string; contentPlain: string }[];
  odontogramEntries?: unknown[];
  bodyChartEntries?: unknown[];
};

export function computeEncounterContentHash(
  payload: CanonicalEncounter,
): string {
  const canonical = stableStringify(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

export function buildCanonicalEncounter(input: {
  encounter: {
    id: string;
    patientId: string;
    professionalId: string;
    modality: string;
    specialty?: string | null;
    startedAt: Date;
    endedAt?: Date | null;
  };
  sections: Array<{
    id: string;
    sectionType: string;
    structuredData: unknown;
    contentPlain?: string | null;
    restrictedToAuthor: boolean;
    sortOrder: number;
  }>;
  amendments: Array<{ id: string; createdAt: Date; contentPlain: string }>;
  odontogramEntries?: unknown[];
  bodyChartEntries?: unknown[];
}): CanonicalEncounter {
  return {
    id: input.encounter.id,
    patientId: input.encounter.patientId,
    professionalId: input.encounter.professionalId,
    modality: input.encounter.modality,
    specialty: input.encounter.specialty,
    startedAt: input.encounter.startedAt.toISOString(),
    endedAt: input.encounter.endedAt?.toISOString() ?? null,
    sections: input.sections
      .map((s) => ({
        id: s.id,
        sectionType: s.sectionType,
        structuredData: s.structuredData,
        contentPlain: s.contentPlain ?? null,
        restrictedToAuthor: s.restrictedToAuthor,
        sortOrder: s.sortOrder,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    amendments: input.amendments.map((a) => ({
      id: a.id,
      createdAt: a.createdAt.toISOString(),
      contentPlain: a.contentPlain,
    })),
    odontogramEntries: input.odontogramEntries,
    bodyChartEntries: input.bodyChartEntries,
  };
}
