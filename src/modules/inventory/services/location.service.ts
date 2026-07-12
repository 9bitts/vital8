import type { TenantClient } from "@/lib/db/tenant-client";

export async function listLocations(db: TenantClient, branchId?: string | null) {
  return db.stockLocation.findMany({
    where: {
      isActive: true,
      ...(branchId ? { branchId } : {}),
    },
    include: { room: true },
    orderBy: [{ isCentral: "desc" }, { name: "asc" }],
  });
}

export async function getCentralLocation(db: TenantClient) {
  return db.stockLocation.findFirst({
    where: { isCentral: true, isActive: true },
  });
}

export async function upsertLocation(
  db: TenantClient,
  organizationId: string,
  input: {
    id?: string;
    name: string;
    isCentral?: boolean;
    roomId?: string | null;
    temperatureControlled?: boolean;
  },
) {
  if (input.isCentral) {
    await db.stockLocation.updateMany({
      where: { isCentral: true },
      data: { isCentral: false },
    });
  }

  const data = {
    organizationId,
    name: input.name,
    isCentral: input.isCentral ?? false,
    roomId: input.roomId ?? null,
    temperatureControlled: input.temperatureControlled ?? false,
  };

  if (input.id) {
    return db.stockLocation.update({ where: { id: input.id }, data });
  }
  return db.stockLocation.create({ data });
}

export async function resolveLocationForRoom(
  db: TenantClient,
  roomId: string | null | undefined,
) {
  if (roomId) {
    const loc = await db.stockLocation.findFirst({
      where: { roomId, isActive: true },
    });
    if (loc) return loc;
  }
  const central = await getCentralLocation(db);
  if (!central) throw new Error("Localização central não configurada");
  return central;
}

export async function findOrCreateBatch(
  db: TenantClient,
  organizationId: string,
  productId: string,
  batchNumber: string,
  expiryDate?: Date | null,
) {
  const existing = await db.stockBatch.findFirst({
    where: { organizationId, productId, batchNumber },
  });
  if (existing) return existing;
  return db.stockBatch.create({
    data: {
      organizationId,
      productId,
      batchNumber,
      expiryDate: expiryDate ?? null,
    },
  });
}
