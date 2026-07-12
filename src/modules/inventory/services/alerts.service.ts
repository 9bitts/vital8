import type { TenantClient } from "@/lib/db/tenant-client";
import { getOrgSettings } from "../lib/inventory-utils";

export async function getInventoryAlerts(
  db: TenantClient,
  organizationId: string,
  branchId?: string | null,
) {
  const settings = await getOrgSettings(organizationId);
  const alertDays = settings.expiryAlertDays ?? [30, 60, 90];
  const maxDays = Math.max(...alertDays, 90);
  const balanceWhere = branchId ? { location: { branchId } } : {};

  const products = await db.product.findMany({ where: { isActive: true } });
  const belowMin = [];
  const expiring = [];

  for (const p of products) {
    const agg = await db.stockBalance.aggregate({
      where: { productId: p.id, ...balanceWhere },
      _sum: { quantity: true },
    });
    const qty = agg._sum.quantity ?? 0;
    if (qty < p.minStock) {
      belowMin.push({ product: p, qty, minStock: p.minStock });
    }
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + maxDays);

  const batches = await db.stockBatch.findMany({
    where: {
      expiryDate: { lte: deadline, gte: new Date() },
    },
    include: { product: true },
  });

  for (const b of batches) {
    if (!b.expiryDate) continue;
    const days = Math.ceil(
      (b.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    const bucket = alertDays.find((d) => days <= d) ?? maxDays;
    expiring.push({ batch: b, product: b.product, daysUntilExpiry: days, bucket });
  }

  return { belowMin, expiring, alertDays };
}

export async function getDashboardSummary(
  db: TenantClient,
  organizationId: string,
  branchId?: string | null,
) {
  const movementWhere = branchId
    ? {
        OR: [
          { fromLocation: { branchId } },
          { toLocation: { branchId } },
        ],
      }
    : {};
  const [alerts, movements, products] = await Promise.all([
    getInventoryAlerts(db, organizationId, branchId),
    db.stockMovement.findMany({
      where: movementWhere,
      take: 15,
      orderBy: { createdAt: "desc" },
      include: { product: true, fromLocation: true, toLocation: true },
    }),
    db.product.findMany({ where: { isActive: true } }),
  ]);

  let totalValueCents = 0;
  for (const p of products) {
    const agg = await db.stockBalance.aggregate({
      where: { productId: p.id },
      _sum: { quantity: true },
    });
    totalValueCents += (agg._sum.quantity ?? 0) * p.averageCostCents;
  }

  return { alerts, movements, totalValueCents };
}
