import { z } from "zod";
import {
  createFullPatient,
  decryptAllergy,
  decryptChronicCondition,
  decryptInsurancePlan,
  decryptPatientRecord,
  getPatientById,
} from "@/modules/patients/services/patient.service";
import { patientPersonalSchema } from "@/modules/patients/schemas/patient.schema";
import { hashCpf } from "@/lib/crypto/search-hash";
import { apiSuccess, decodeCursor, encodeCursor, parseLimit } from "../lib/response";
import { notFound, validationError } from "../lib/errors";
import { toPatientDto } from "../serializers/dtos";
import { auditApiWrite } from "../lib/router";
import type { ApiContext } from "../middleware/authenticate";
import { emitWebhookEvent } from "../services/webhook.service";

const createPatientSchema = z.object({
  fullName: z.string().min(2),
  cpf: z.string().optional(),
  birthDate: z.string().optional(),
  email: z.string().email().optional(),
  phones: z.array(z.object({ number: z.string(), label: z.string().optional() })).optional(),
});

export async function listPatients(req: Request, ctx: ApiContext) {
  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursorRaw = url.searchParams.get("cursor");
  const updatedAfter = url.searchParams.get("updatedAfter");
  const cpf = url.searchParams.get("cpf");
  const q = url.searchParams.get("q");

  let where: Record<string, unknown> = { isActive: true };
  if (updatedAfter) {
    where.updatedAt = { gte: new Date(updatedAfter) };
  }
  if (cpf) {
    where.cpfHash = hashCpf(cpf, ctx.organizationId);
  }
  if (q && !cpf) {
    where.OR = [
      { searchName: { contains: q.toLowerCase() } },
      { phoneSearch: { contains: q.replace(/\D/g, "") } },
    ];
  }
  if (cursorRaw) {
    const c = decodeCursor(cursorRaw);
    if (c) {
      where = {
        AND: [
          where,
          {
            OR: [
              { updatedAt: { gt: c.updatedAt } },
              { updatedAt: c.updatedAt, id: { gt: c.id } },
            ],
          },
        ],
      };
    }
  }

  const rows = await ctx.db.patient.findMany({
    where,
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const dtos = page.map((p) => toPatientDto(decryptPatientRecord(p)));
  const last = page[page.length - 1];
  return apiSuccess(dtos, {
    limit,
    hasMore,
    cursor: hasMore && last ? encodeCursor(last.id, last.updatedAt) : null,
  });
}

export async function getPatient(ctx: ApiContext, id: string) {
  const p = await getPatientById(ctx.db, id);
  if (!p) throw notFound("Paciente");
  return apiSuccess(toPatientDto(decryptPatientRecord(p)));
}

export async function createPatientHandler(req: Request, ctx: ApiContext) {
  const body = createPatientSchema.safeParse(await req.json());
  if (!body.success) throw validationError("Payload inválido", body.error.issues);

  const personal = patientPersonalSchema.parse({
    fullName: body.data.fullName,
    cpf: body.data.cpf,
    birthDate: body.data.birthDate,
  });

  const created = await createFullPatient(
    ctx.db,
    ctx.organizationId,
    personal,
    {
      email: body.data.email,
      phones: body.data.phones ?? [],
    },
  );

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await auditApiWrite(ctx, "patient.create.api", "Patient", created.id, ip);
  await emitWebhookEvent(ctx.organizationId, "patient.created", {
    id: created.id,
    event: "patient.created",
    occurredAt: new Date().toISOString(),
  });

  const full = await getPatientById(ctx.db, created.id);
  return apiSuccess(toPatientDto(decryptPatientRecord(full!)), undefined, 201);
}

export async function deactivatePatient(ctx: ApiContext, id: string, req: Request) {
  const p = await ctx.db.patient.findFirst({ where: { id } });
  if (!p) throw notFound("Paciente");
  await ctx.db.patient.update({ where: { id }, data: { isActive: false } });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await auditApiWrite(ctx, "patient.deactivate.api", "Patient", id, ip);
  await emitWebhookEvent(ctx.organizationId, "patient.updated", {
    id,
    event: "patient.updated",
    occurredAt: new Date().toISOString(),
  });
  return apiSuccess({ id, isActive: false });
}

export async function listPatientInsurance(ctx: ApiContext, patientId: string) {
  const p = await ctx.db.patient.findFirst({ where: { id: patientId } });
  if (!p) throw notFound("Paciente");
  const plans = await ctx.db.patientInsurancePlan.findMany({
    where: { patientId, deletedAt: null },
    include: { healthInsurer: true },
  });
  return apiSuccess(
    plans.map((pl) => ({
      id: pl.id,
      insurerId: pl.healthInsurerId,
      insurerName: pl.healthInsurer?.name ?? pl.insurerName,
      planName: pl.planName,
      cardNumber: decryptInsurancePlan(pl).cardNumber,
      isPrimary: pl.isPrimary,
      validUntil: pl.validUntil?.toISOString().slice(0, 10) ?? null,
    })),
  );
}

export async function listPatientAllergies(ctx: ApiContext, patientId: string) {
  const p = await ctx.db.patient.findFirst({ where: { id: patientId } });
  if (!p) throw notFound("Paciente");
  const rows = await ctx.db.allergy.findMany({ where: { patientId } });
  return apiSuccess(rows.map((a) => ({ id: a.id, notes: decryptAllergy(a).notes, severity: a.severity, substance: a.substance })));
}

export async function listPatientConditions(ctx: ApiContext, patientId: string) {
  const p = await ctx.db.patient.findFirst({ where: { id: patientId } });
  if (!p) throw notFound("Paciente");
  const rows = await ctx.db.chronicCondition.findMany({ where: { patientId } });
  return apiSuccess(rows.map((c) => ({ id: c.id, notes: decryptChronicCondition(c).notes, condition: c.condition })));
}

export async function listPatientConsents(ctx: ApiContext, patientId: string) {
  const p = await ctx.db.patient.findFirst({ where: { id: patientId } });
  if (!p) throw notFound("Paciente");
  const rows = await ctx.db.patientConsent.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
  });
  return apiSuccess(
    rows.map((c) => ({
      id: c.id,
      termKey: c.termKey,
      purpose: c.purpose,
      channel: c.channel,
      grantedAt: c.grantedAt.toISOString(),
      revokedAt: c.revokedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
  );
}
