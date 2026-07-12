import type { TenantClient } from "@/lib/db/tenant-client";
import { decimalToCents } from "@/lib/money";

export async function resolveServicePriceCents(
  db: TenantClient,
  serviceId: string,
  isPrivate: boolean,
  insurerName?: string | null,
): Promise<number> {
  const now = new Date();

  if (!isPrivate && insurerName) {
    const table = await db.priceTable.findFirst({
      where: {
        insurerName,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
      include: {
        items: { where: { serviceId } },
      },
    });
    const item = table?.items[0];
    if (item) return item.priceCents;
  }

  const defaultTable = await db.priceTable.findFirst({
    where: {
      isDefault: true,
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    include: { items: { where: { serviceId } } },
  });
  const defaultItem = defaultTable?.items[0];
  if (defaultItem) return defaultItem.priceCents;

  const service = await db.service.findFirstOrThrow({ where: { id: serviceId } });
  return decimalToCents(service.privatePrice);
}

export async function getDefaultPriceTable(db: TenantClient) {
  return db.priceTable.findFirst({
    where: { isDefault: true, isActive: true },
    include: { items: { include: { service: true } } },
  });
}
