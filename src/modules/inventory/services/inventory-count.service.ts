import type { TenantClient } from "@/lib/db/tenant-client";
import { createStockMovement } from "./movement.service";

export async function openInventory(
  db: TenantClient,
  organizationId: string,
  locationId: string,
  userId: string,
) {
  const balances = await db.stockBalance.findMany({
    where: { locationId, quantity: { gt: 0 } },
    include: { product: true, batch: true },
  });

  const inventory = await db.inventory.create({
    data: {
      organizationId,
      locationId,
      openedByUserId: userId,
      status: "EM_CONTAGEM",
      counts: {
        create: balances.map((b) => ({
          organizationId,
          productId: b.productId,
          batchId: b.batchId,
          expectedQty: b.quantity,
        })),
      },
    },
    include: { counts: { include: { product: true, batch: true } }, location: true },
  });

  return inventory;
}

export async function recordCount(
  db: TenantClient,
  countId: string,
  countedQty: number,
) {
  return db.inventoryCount.update({
    where: { id: countId },
    data: { countedQty },
  });
}

export async function closeInventory(
  db: TenantClient,
  organizationId: string,
  inventoryId: string,
  userId: string,
) {
  const inventory = await db.inventory.findFirstOrThrow({
    where: { id: inventoryId },
    include: { counts: true, location: true },
  });

  if (inventory.status === "FECHADO") {
    throw new Error("Inventário já fechado");
  }

  for (const count of inventory.counts) {
    if (count.countedQty === null) continue;
    const diff = count.countedQty - count.expectedQty;
    if (diff === 0) continue;

    if (diff > 0) {
      await createStockMovement(db, organizationId, {
        movementType: "AJUSTE_INVENTARIO",
        productId: count.productId,
        batchId: count.batchId,
        toLocationId: inventory.locationId,
        quantity: diff,
        unitCostCents: 0,
        reason: `Inventário ${inventoryId} — sobra`,
        userId,
        inventoryId,
      });
    } else {
      await createStockMovement(db, organizationId, {
        movementType: "AJUSTE_INVENTARIO",
        productId: count.productId,
        batchId: count.batchId,
        fromLocationId: inventory.locationId,
        quantity: Math.abs(diff),
        unitCostCents: 0,
        reason: `Inventário ${inventoryId} — falta`,
        userId,
        inventoryId,
      });
    }
  }

  return db.inventory.update({
    where: { id: inventoryId },
    data: {
      status: "FECHADO",
      closedAt: new Date(),
      closedByUserId: userId,
    },
    include: { counts: { include: { product: true, batch: true } } },
  });
}

export async function listInventories(db: TenantClient) {
  return db.inventory.findMany({
    include: {
      location: true,
      counts: { include: { product: true, batch: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInventoryDivergences(db: TenantClient, inventoryId: string) {
  const counts = await db.inventoryCount.findMany({
    where: { inventoryId },
    include: { product: true, batch: true },
  });
  return counts
    .filter((c) => c.countedQty !== null && c.countedQty !== c.expectedQty)
    .map((c) => ({
      ...c,
      diff: (c.countedQty ?? 0) - c.expectedQty,
    }));
}
