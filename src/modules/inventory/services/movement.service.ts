import type { Prisma, StockMovement, StockMovementType } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";
import type { TenantClient } from "@/lib/db/tenant-client";
import {
  getOrgSettings,
  isInboundMovement,
  isOutboundMovement,
  planFEFOAllocation,
  recalculateMovingAverage,
  requiresReason,
} from "../lib/inventory-utils";

type Tx = Prisma.TransactionClient;

export type CreateMovementInput = {
  movementType: StockMovementType;
  productId: string;
  batchId?: string | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  quantity: number;
  unitCostCents?: number;
  reason?: string | null;
  userId: string;
  purchaseOrderId?: string | null;
  purchaseOrderItemId?: string | null;
  saleId?: string | null;
  encounterId?: string | null;
  appointmentId?: string | null;
  inventoryId?: string | null;
};

async function findOrCreateBalance(
  tx: Tx,
  organizationId: string,
  productId: string,
  locationId: string,
  batchId: string | null,
) {
  const existing = await tx.stockBalance.findFirst({
    where: {
      organizationId,
      productId,
      locationId,
      batchId,
    },
  });
  if (existing) return existing;
  return tx.stockBalance.create({
    data: {
      organizationId,
      productId,
      locationId,
      batchId,
      quantity: 0,
    },
  });
}

async function applyDelta(
  tx: Tx,
  organizationId: string,
  productId: string,
  locationId: string,
  batchId: string | null,
  delta: number,
  allowNegative: boolean,
) {
  const balance = await findOrCreateBalance(
    tx,
    organizationId,
    productId,
    locationId,
    batchId,
  );

  if (delta < 0) {
    const result = await tx.stockBalance.updateMany({
      where: {
        id: balance.id,
        quantity: allowNegative ? undefined : { gte: Math.abs(delta) },
      },
      data: { quantity: { increment: delta } },
    });
    if (result.count === 0) {
      throw new Error("Estoque insuficiente para a operação");
    }
    return;
  }

  await tx.stockBalance.update({
    where: { id: balance.id },
    data: { quantity: { increment: delta } },
  });
}

async function validateProductAndBatch(
  tx: Tx,
  organizationId: string,
  productId: string,
  batchId: string | null | undefined,
  reason: string | null | undefined,
  movementType: StockMovementType,
) {
  const product = await tx.product.findFirstOrThrow({
    where: { id: productId, organizationId },
  });

  if (requiresReason(movementType) && !reason?.trim()) {
    throw new Error("Motivo obrigatório para este tipo de movimento");
  }

  if (product.isControlled && !batchId) {
    throw new Error("Item controlado exige lote");
  }

  if (product.requiresBatchExpiry && !batchId && isOutboundMovement(movementType)) {
    throw new Error("Produto exige lote/validade");
  }

  return product;
}

export async function createStockMovement(
  db: TenantClient,
  organizationId: string,
  input: CreateMovementInput,
) {
  const settings = await getOrgSettings(organizationId);

  return adminPrisma.$transaction(
    async (tx) => {
      const product = await validateProductAndBatch(
        tx,
        organizationId,
        input.productId,
        input.batchId,
        input.reason,
        input.movementType,
      );

      if (input.quantity <= 0) {
        throw new Error("Quantidade deve ser positiva");
      }

      if (input.movementType === "TRANSFERENCIA") {
        if (!input.fromLocationId || !input.toLocationId) {
          throw new Error("Transferência exige origem e destino");
        }
        await applyDelta(
          tx,
          organizationId,
          input.productId,
          input.fromLocationId,
          input.batchId ?? null,
          -input.quantity,
          settings.allowNegativeStock ?? false,
        );
        await applyDelta(
          tx,
          organizationId,
          input.productId,
          input.toLocationId,
          input.batchId ?? null,
          input.quantity,
          true,
        );
      } else if (input.movementType === "AJUSTE_INVENTARIO") {
        if (input.fromLocationId && !input.toLocationId) {
          await applyDelta(
            tx,
            organizationId,
            input.productId,
            input.fromLocationId,
            input.batchId ?? null,
            -input.quantity,
            settings.allowNegativeStock ?? false,
          );
        } else if (input.toLocationId) {
          await applyDelta(
            tx,
            organizationId,
            input.productId,
            input.toLocationId,
            input.batchId ?? null,
            input.quantity,
            true,
          );
        } else {
          throw new Error("Ajuste exige localização");
        }
      } else if (isInboundMovement(input.movementType)) {
        const loc = input.toLocationId;
        if (!loc) throw new Error("Entrada exige localização de destino");
        await applyDelta(
          tx,
          organizationId,
          input.productId,
          loc,
          input.batchId ?? null,
          input.quantity,
          true,
        );

        const totalQty = await tx.stockBalance.aggregate({
          where: { organizationId, productId: input.productId },
          _sum: { quantity: true },
        });
        const currentQty = Math.max(0, (totalQty._sum.quantity ?? 0) - input.quantity);
        const newAvg = recalculateMovingAverage(
          currentQty,
          product.averageCostCents,
          input.quantity,
          input.unitCostCents ?? 0,
        );
        await tx.product.update({
          where: { id: product.id },
          data: { averageCostCents: newAvg },
        });
      } else if (isOutboundMovement(input.movementType)) {
        const loc = input.fromLocationId;
        if (!loc) throw new Error("Saída exige localização de origem");
        await applyDelta(
          tx,
          organizationId,
          input.productId,
          loc,
          input.batchId ?? null,
          -input.quantity,
          settings.allowNegativeStock ?? false,
        );
      } else if (input.movementType === "ESTORNO") {
        throw new Error("Use reverseStockMovement para estornos");
      }

      return tx.stockMovement.create({
        data: {
          organizationId,
          movementType: input.movementType,
          productId: input.productId,
          batchId: input.batchId ?? null,
          fromLocationId: input.fromLocationId ?? null,
          toLocationId: input.toLocationId ?? null,
          quantity: Math.abs(input.quantity),
          unitCostCents: input.unitCostCents ?? product.averageCostCents,
          reason: input.reason ?? null,
          userId: input.userId,
          purchaseOrderId: input.purchaseOrderId ?? null,
          purchaseOrderItemId: input.purchaseOrderItemId ?? null,
          saleId: input.saleId ?? null,
          encounterId: input.encounterId ?? null,
          appointmentId: input.appointmentId ?? null,
          inventoryId: input.inventoryId ?? null,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export async function consumeFEFO(
  db: TenantClient,
  organizationId: string,
  input: Omit<CreateMovementInput, "batchId" | "quantity"> & {
    locationId: string;
    quantityNeeded: number;
  },
) {
  const settings = await getOrgSettings(organizationId);
  const movements: StockMovement[] = [];

  await adminPrisma.$transaction(
    async (tx) => {
      const product = await tx.product.findFirstOrThrow({
        where: { id: input.productId, organizationId },
      });

      if (input.quantityNeeded <= 0) return;

      const balances = await tx.stockBalance.findMany({
        where: {
          organizationId,
          productId: input.productId,
          locationId: input.locationId,
          quantity: { gt: 0 },
        },
        include: { batch: true },
      });

      const { allocations, remaining } = planFEFOAllocation(
        balances.map((bal) => ({
          batchId: bal.batchId ?? `no-batch-${bal.id}`,
          quantity: bal.quantity,
          expiryDate: bal.batch?.expiryDate ?? null,
        })),
        input.quantityNeeded,
      );

      for (const alloc of allocations) {
        const bal = balances.find(
          (b) => (b.batchId ?? `no-batch-${b.id}`) === alloc.batchId,
        );
        if (!bal) continue;
        const take = alloc.take;

        await applyDelta(
          tx,
          organizationId,
          input.productId,
          input.locationId,
          bal.batchId,
          -take,
          settings.allowNegativeStock ?? false,
        );

        const mov = await tx.stockMovement.create({
          data: {
            organizationId,
            movementType: input.movementType,
            productId: input.productId,
            batchId: bal.batchId,
            fromLocationId: input.locationId,
            quantity: take,
            unitCostCents: product.averageCostCents,
            reason: input.reason ?? null,
            userId: input.userId,
            encounterId: input.encounterId ?? null,
            appointmentId: input.appointmentId ?? null,
            saleId: input.saleId ?? null,
          },
        });
        movements.push(mov);
      }

      if (remaining > 0 && !settings.allowNegativeStock) {
        throw new Error("Estoque insuficiente (FEFO)");
      }

      if (remaining > 0 && settings.allowNegativeStock) {
        const mov = await tx.stockMovement.create({
          data: {
            organizationId,
            movementType: input.movementType,
            productId: input.productId,
            fromLocationId: input.locationId,
            quantity: remaining,
            unitCostCents: product.averageCostCents,
            reason: input.reason ?? null,
            userId: input.userId,
            encounterId: input.encounterId ?? null,
            appointmentId: input.appointmentId ?? null,
          },
        });
        movements.push(mov);
        await applyDelta(
          tx,
          organizationId,
          input.productId,
          input.locationId,
          null,
          -remaining,
          true,
        );
      }
    },
    { isolationLevel: "Serializable" },
  );

  void db;
  return movements;
}

export async function reverseStockMovement(
  organizationId: string,
  movementId: string,
  userId: string,
  reason: string,
) {
  return adminPrisma.$transaction(async (tx) => {
    const original = await tx.stockMovement.findFirstOrThrow({
      where: { id: movementId, organizationId },
    });

    if (original.reversedMovementId) {
      throw new Error("Movimento já estornado");
    }
    const existingReversal = await tx.stockMovement.findFirst({
      where: { reversedMovementId: original.id },
    });
    if (existingReversal) {
      throw new Error("Movimento já estornado");
    }

    const reverseType: StockMovementType = "ESTORNO";
    const settings = await getOrgSettings(organizationId);

    if (original.fromLocationId) {
      await applyDelta(
        tx,
        organizationId,
        original.productId,
        original.fromLocationId,
        original.batchId,
        original.quantity,
        true,
      );
    }
    if (original.toLocationId) {
      await applyDelta(
        tx,
        organizationId,
        original.productId,
        original.toLocationId,
        original.batchId,
        -original.quantity,
        settings.allowNegativeStock ?? false,
      );
    }

    return tx.stockMovement.create({
      data: {
        organizationId,
        movementType: reverseType,
        productId: original.productId,
        batchId: original.batchId,
        fromLocationId: original.toLocationId,
        toLocationId: original.fromLocationId,
        quantity: original.quantity,
        unitCostCents: original.unitCostCents,
        reason,
        userId,
        reversedMovementId: original.id,
      },
    });
  });
}

export async function getProductTotalQty(
  db: TenantClient,
  productId: string,
): Promise<number> {
  const agg = await db.stockBalance.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

export async function getKardex(
  db: TenantClient,
  productId: string,
  filters?: { locationId?: string; from?: Date; to?: Date },
) {
  const movements = await db.stockMovement.findMany({
    where: {
      productId,
      ...(filters?.locationId
        ? {
            OR: [
              { fromLocationId: filters.locationId },
              { toLocationId: filters.locationId },
            ],
          }
        : {}),
      ...(filters?.from || filters?.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: {
      batch: true,
      fromLocation: true,
      toLocation: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let running = 0;
  return movements.map((m) => {
    const inbound = m.toLocationId && !m.fromLocationId;
    const outbound = m.fromLocationId && !m.toLocationId;
    const transferOut = m.movementType === "TRANSFERENCIA" && m.fromLocationId;
    if (inbound || (m.movementType === "TRANSFERENCIA" && m.toLocationId)) {
      running += m.quantity;
    } else if (outbound || transferOut || isOutboundMovement(m.movementType)) {
      running -= m.quantity;
    } else if (m.movementType === "AJUSTE_INVENTARIO") {
      running += m.toLocationId ? m.quantity : -m.quantity;
    }
    return { ...m, runningBalance: running };
  });
}
