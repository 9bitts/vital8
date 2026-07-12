import { BR_TERMINOLOGY } from "../lib/identifiers";
import type { FhirObservation } from "../types/fhir-types";
import type { Vital8Observation } from "../types/vital8-types";

function parseReferenceRange(range?: string | null): FhirObservation["referenceRange"] {
  if (!range) return undefined;
  const match = range.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  if (match) {
    return [{ text: range, low: { value: parseFloat(match[1]) }, high: { value: parseFloat(match[2]) } }];
  }
  return [{ text: range }];
}

export function observationToFhir(o: Vital8Observation): FhirObservation {
  const numVal = parseFloat(o.value);
  const isNumeric = !Number.isNaN(numVal);

  return {
    resourceType: "Observation",
    id: o.id,
    status: "final",
    category: [
      {
        coding: [
          { system: BR_TERMINOLOGY.OBSERVATION_CATEGORY, code: "laboratory", display: "Laboratory" },
        ],
      },
    ],
    code: { text: o.name },
    subject: { reference: `Patient/${o.patientId}` },
    effectiveDateTime: o.resultedAt,
    ...(isNumeric
      ? { valueQuantity: { value: numVal, unit: o.unit ?? undefined } }
      : { valueString: o.value }),
    referenceRange: parseReferenceRange(o.referenceRange),
  };
}

export function observationFromFhir(fhir: FhirObservation, patientId: string, resultId: string): Vital8Observation {
  const value =
    fhir.valueQuantity?.value?.toString() ??
    fhir.valueString ??
    "";
  const refRange =
    fhir.referenceRange?.[0]?.text ??
    (fhir.referenceRange?.[0]?.low && fhir.referenceRange?.[0]?.high
      ? `${fhir.referenceRange[0].low.value}-${fhir.referenceRange[0].high.value}`
      : null);

  return {
    id: fhir.id ?? "",
    patientId,
    resultId,
    name: fhir.code?.text ?? fhir.code?.coding?.[0]?.display ?? "",
    value,
    unit: fhir.valueQuantity?.unit ?? null,
    referenceRange: refRange,
    resultedAt: fhir.effectiveDateTime ?? new Date().toISOString(),
  };
}

export function isOutOfReference(value: string, referenceRange?: string | null): boolean {
  if (!referenceRange) return false;
  const numVal = parseFloat(value);
  if (Number.isNaN(numVal)) return false;
  const match = referenceRange.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  if (!match) return false;
  const low = parseFloat(match[1]);
  const high = parseFloat(match[2]);
  return numVal < low || numVal > high;
}
