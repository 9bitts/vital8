import type { TenantClient } from "@/lib/db/tenant-client";
import { healthInsurerSchema, insurerContractSchema } from "../schemas/tiss.schema";

export async function listHealthInsurers(db: TenantClient) {
  return db.healthInsurer.findMany({
    orderBy: { name: "asc" },
    include: {
      contracts: {
        where: { isActive: true },
        include: { priceTable: true },
      },
    },
  });
}

export async function getHealthInsurer(db: TenantClient, id: string) {
  return db.healthInsurer.findFirstOrThrow({
    where: { id },
    include: {
      contracts: { include: { priceTable: true } },
    },
  });
}

export async function upsertHealthInsurer(
  db: TenantClient,
  organizationId: string,
  input: unknown,
) {
  const data = healthInsurerSchema.parse(input);
  const payload = {
    organizationId,
    name: data.name,
    ansRegistration: data.ansRegistration,
    cnpj: data.cnpj.replace(/\D/g, ""),
    tissVersion: data.tissVersion,
    providerCodeAtInsurer: data.providerCodeAtInsurer || null,
    contactEmail: data.contactEmail || null,
    contactPhone: data.contactPhone || null,
    paymentTermDays: data.paymentTermDays,
    batchClosingDay: data.batchClosingDay,
    requiresAuthorization: data.requiresAuthorization,
    authProcedureTypes: data.authProcedureTypes,
    coparticipationPercent: data.coparticipationPercent,
    isActive: data.isActive,
  };

  if (data.id) {
    return db.healthInsurer.update({ where: { id: data.id }, data: payload });
  }
  return db.healthInsurer.create({ data: payload });
}

export async function createInsurerContract(
  db: TenantClient,
  organizationId: string,
  input: unknown,
) {
  const data = insurerContractSchema.parse(input);
  return db.insurerContract.create({
    data: {
      organizationId,
      healthInsurerId: data.healthInsurerId,
      priceTableId: data.priceTableId,
      validFrom: data.validFrom ?? new Date(),
      validUntil: data.validUntil ?? null,
      adjustmentNotes: data.adjustmentNotes ?? null,
    },
  });
}

export async function resolveInsurerPriceCents(
  db: TenantClient,
  healthInsurerId: string,
  serviceId: string,
): Promise<number | null> {
  const contract = await db.insurerContract.findFirst({
    where: {
      healthInsurerId,
      isActive: true,
      validFrom: { lte: new Date() },
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
    include: {
      priceTable: {
        include: { items: { where: { serviceId } } },
      },
    },
  });
  return contract?.priceTable.items[0]?.priceCents ?? null;
}
