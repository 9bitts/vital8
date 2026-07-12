import type { TenantClient } from "@/lib/db/tenant-client";
import { priorAuthorizationSchema } from "../schemas/tiss.schema";

export async function listPriorAuthorizations(
  db: TenantClient,
  filters?: { status?: string; patientId?: string },
) {
  return db.priorAuthorization.findMany({
    where: {
      ...(filters?.status ? { status: filters.status as never } : {}),
      ...(filters?.patientId ? { patientId: filters.patientId } : {}),
    },
    include: {
      patient: true,
      healthInsurer: true,
      service: true,
      tussProcedure: true,
    },
    orderBy: { requestDate: "desc" },
  });
}

export async function listExpiringAuthorizations(db: TenantClient, withinDays = 7) {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + withinDays);

  return db.priorAuthorization.findMany({
    where: {
      status: "AUTORIZADA",
      validUntil: { lte: deadline, gte: new Date() },
    },
    include: { patient: true, healthInsurer: true, service: true, tussProcedure: true },
    orderBy: { validUntil: "asc" },
  });
}

export async function upsertPriorAuthorization(
  db: TenantClient,
  organizationId: string,
  input: unknown,
) {
  const data = priorAuthorizationSchema.parse(input);
  const payload = {
    organizationId,
    healthInsurerId: data.healthInsurerId,
    patientId: data.patientId,
    serviceId: data.serviceId ?? null,
    password: data.password ?? null,
    validUntil: data.validUntil ?? null,
    authorizedQty: data.authorizedQty,
    status: data.status ?? "SOLICITADA",
    notes: data.notes ?? null,
  };

  if (data.id) {
    return db.priorAuthorization.update({ where: { id: data.id }, data: payload });
  }
  return db.priorAuthorization.create({ data: payload });
}

export async function findValidAuthorization(
  db: TenantClient,
  healthInsurerId: string,
  patientId: string,
  serviceId: string,
) {
  return db.priorAuthorization.findFirst({
    where: {
      healthInsurerId,
      patientId,
      serviceId,
      status: "AUTORIZADA",
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
    orderBy: { validUntil: "desc" },
  });
}

export async function consumeAuthorization(
  db: TenantClient,
  authorizationId: string,
) {
  const auth = await db.priorAuthorization.findFirstOrThrow({
    where: { id: authorizationId },
  });
  const consumed = auth.consumedQty + 1;
  const status = consumed >= auth.authorizedQty ? auth.status : auth.status;

  return db.priorAuthorization.update({
    where: { id: authorizationId },
    data: { consumedQty: consumed, status },
  });
}
