import type { Patient } from "@/generated/prisma/client";
import { decryptPHI } from "@/lib/crypto/phi";
import type { ApiContext } from "@/modules/api/middleware/authenticate";
import { apiSuccess, decodeCursor, encodeCursor, parseLimit } from "@/modules/api/lib/response";
import { notFound } from "@/modules/api/lib/errors";
import type { ApiScope } from "@/modules/api/lib/scopes";
import {
  patientToFhir,
  appointmentToFhir,
  encounterToFhir,
  diagnosticReportWithObservations,
  serviceRequestToFhir,
  practitionerToFhir,
} from "../mappers";
import type {
  Vital8Patient,
  Vital8Encounter,
  Vital8DiagnosticReport,
  Vital8Professional,
} from "../types/vital8-types";

export const FHIR_RESOURCE_SCOPES: Record<string, ApiScope[]> = {
  Patient: ["patients:read"],
  Appointment: ["appointments:read"],
  Encounter: ["encounters:read"],
  DiagnosticReport: ["encounters:read"],
  ServiceRequest: ["encounters:read"],
  Practitioner: ["schedule:read"],
  Observation: ["encounters:read"],
};

function decryptPhones(encrypted?: string | null): string | null {
  if (!encrypted) return null;
  try {
    const parsed = JSON.parse(decryptPHI(encrypted)) as Array<{ number?: string }>;
    return parsed[0]?.number ?? null;
  } catch {
    return null;
  }
}

function toVital8Patient(p: Patient): Vital8Patient {
  return {
    id: p.id,
    organizationId: p.organizationId,
    fullName: p.fullName,
    socialName: p.socialName,
    cpf: p.cpfEncrypted ? decryptPHI(p.cpfEncrypted) : null,
    cns: p.cnsEncrypted ? decryptPHI(p.cnsEncrypted) : null,
    birthDate: p.birthDate?.toISOString().slice(0, 10) ?? null,
    sex: p.sex,
    phone: decryptPhones(p.phonesEncrypted),
    email: p.emailEncrypted ? decryptPHI(p.emailEncrypted) : null,
    isActive: p.isActive,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listFhirResources(req: Request, ctx: ApiContext, resourceType: string) {
  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursorRaw = url.searchParams.get("cursor");
  const lastUpdated = url.searchParams.get("_lastUpdated");

  const where: Record<string, unknown> = {};
  if (cursorRaw) {
    const c = decodeCursor(cursorRaw);
    if (c) where.id = { gt: c.id };
  }
  if (lastUpdated) {
    const since = new Date(lastUpdated);
    if (!Number.isNaN(since.getTime())) where.updatedAt = { gte: since };
  }

  let resources: unknown[] = [];
  let rows: Array<{ id: string; updatedAt: Date }> = [];

  switch (resourceType) {
    case "Patient": {
      const patients = await ctx.db.patient.findMany({
        where,
        take: limit + 1,
        orderBy: { id: "asc" },
      });
      rows = patients;
      resources = patients.map((p) => patientToFhir(toVital8Patient(p)));
      break;
    }
    case "Appointment": {
      const appts = await ctx.db.appointment.findMany({
        where,
        take: limit + 1,
        orderBy: { id: "asc" },
      });
      rows = appts;
      resources = appts.map((a) =>
        appointmentToFhir({
          id: a.id,
          organizationId: a.organizationId,
          patientId: a.patientId,
          professionalId: a.professionalId,
          serviceId: a.serviceId,
          branchId: a.branchId,
          status: a.status,
          startsAt: a.startsAt.toISOString(),
          endsAt: a.endsAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        }),
      );
      break;
    }
    case "Encounter": {
      const encounters = await ctx.db.encounter.findMany({
        where,
        take: limit + 1,
        orderBy: { id: "asc" },
      });
      rows = encounters;
      resources = encounters.map((e) =>
        encounterToFhir({
          id: e.id,
          organizationId: e.organizationId,
          patientId: e.patientId,
          professionalId: e.professionalId,
          appointmentId: e.appointmentId,
          status: e.status,
          modality: e.modality,
          specialty: e.specialty,
          startedAt: e.startedAt.toISOString(),
          endedAt: e.endedAt?.toISOString() ?? null,
          signedAt: e.signedAt?.toISOString() ?? null,
          contentHash: e.contentHash,
          updatedAt: e.updatedAt.toISOString(),
        }),
      );
      break;
    }
    case "DiagnosticReport": {
      const results = await ctx.db.examResult.findMany({
        where,
        take: limit + 1,
        orderBy: { id: "asc" },
        include: { values: true },
      });
      rows = results.map((r) => ({ id: r.id, updatedAt: r.createdAt }));
      resources = results.map((r) => {
        const report: Vital8DiagnosticReport = {
          id: r.id,
          organizationId: r.organizationId,
          patientId: r.patientId,
          requestId: r.requestId,
          encounterId: r.encounterId,
          fileName: r.fileName,
          mimeType: r.mimeType,
          resultedAt: r.resultedAt.toISOString(),
          observations: r.values.map((v) => ({
            id: v.id,
            patientId: r.patientId,
            resultId: r.id,
            name: v.name,
            value: v.value,
            unit: v.unit,
            referenceRange: v.referenceRange,
            resultedAt: r.resultedAt.toISOString(),
          })),
          updatedAt: r.createdAt.toISOString(),
        };
        return diagnosticReportWithObservations(report).report;
      });
      break;
    }
    case "ServiceRequest": {
      const requestWhere: { id?: { gt: string }; createdAt?: { gte: Date } } = {};
      if (where.id) requestWhere.id = where.id as { gt: string };
      if (lastUpdated) {
        const since = new Date(lastUpdated);
        if (!Number.isNaN(since.getTime())) requestWhere.createdAt = { gte: since };
      }
      const requests = await ctx.db.examRequest.findMany({
        where: requestWhere,
        take: limit + 1,
        orderBy: { id: "asc" },
        include: { items: true },
      });
      rows = requests.map((r) => ({ id: r.id, updatedAt: r.createdAt }));
      resources = requests.map((r) =>
        serviceRequestToFhir({
          id: r.id,
          organizationId: r.organizationId,
          patientId: r.patientId,
          encounterId: r.encounterId,
          authorUserId: r.authorUserId,
          items: r.items.map((i) => ({ examName: i.examName, instructions: i.instructions })),
          createdAt: r.createdAt.toISOString(),
        }),
      );
      break;
    }
    case "Practitioner": {
      const profs = await ctx.db.professional.findMany({
        where: { ...where, isActive: true },
        take: limit + 1,
        orderBy: { id: "asc" },
      });
      rows = profs;
      resources = profs.map((p) =>
        practitionerToFhir({
          id: p.id,
          organizationId: p.organizationId,
          displayName: p.displayName,
          councilType: p.councilType,
          councilNumber: p.councilNumber,
          councilState: p.councilState,
          specialties: p.specialties,
          isActive: p.isActive,
          updatedAt: p.updatedAt.toISOString(),
        } satisfies Vital8Professional),
      );
      break;
    }
    default:
      throw notFound(`Recurso FHIR não suportado: ${resourceType}`);
  }

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return apiSuccess(
    {
      resourceType: "Bundle",
      type: "searchset",
      total: page.length,
      entry: resources.map((r, i) => ({
        fullUrl: `${url.origin}/api/v1/fhir/${resourceType}/${page[i]?.id}`,
        resource: r,
      })),
    },
    {
      limit,
      hasMore,
      cursor: hasMore && last ? encodeCursor(last.id, last.updatedAt) : null,
    },
  );
}

export async function getFhirResource(ctx: ApiContext, resourceType: string, id: string) {
  switch (resourceType) {
    case "Patient": {
      const p = await ctx.db.patient.findFirst({ where: { id } });
      if (!p) throw notFound("Patient não encontrado");
      return patientToFhir(toVital8Patient(p));
    }
    case "Encounter": {
      const e = await ctx.db.encounter.findFirst({ where: { id } });
      if (!e) throw notFound("Encounter não encontrado");
      return encounterToFhir({
        id: e.id,
        organizationId: e.organizationId,
        patientId: e.patientId,
        professionalId: e.professionalId,
        appointmentId: e.appointmentId,
        status: e.status,
        modality: e.modality,
        specialty: e.specialty,
        startedAt: e.startedAt.toISOString(),
        endedAt: e.endedAt?.toISOString() ?? null,
        signedAt: e.signedAt?.toISOString() ?? null,
        contentHash: e.contentHash,
        updatedAt: e.updatedAt.toISOString(),
      } satisfies Vital8Encounter);
    }
    default:
      throw notFound(`Recurso FHIR não suportado: ${resourceType}`);
  }
}
