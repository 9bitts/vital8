import type { TenantClient } from "@/lib/db/tenant-client";
import {
  purchaseToConsumeQty,
  purchaseUnitCostToConsumeUnitCost,
} from "../lib/inventory-utils";
import { createStockMovement } from "./movement.service";
import { findOrCreateBatch } from "./location.service";

export type PurchaseItemInput = {
  productId: string;
  orderedQtyPurchase: number;
  unitCostCents: number;
};

export type ReceiveLineInput = {
  orderItemId: string;
  qtyPurchase: number;
  batchNumber?: string;
  expiryDate?: Date | null;
};

export async function createPurchaseOrder(
  db: TenantClient,
  organizationId: string,
  userId: string,
  input: {
    supplierId: string;
    notes?: string;
    expectedDelivery?: Date;
    items: PurchaseItemInput[];
    createPayable?: boolean;
  },
) {
  const totalCents = input.items.reduce(
    (s, i) => s + i.orderedQtyPurchase * i.unitCostCents,
    0,
  );

  const order = await db.purchaseOrder.create({
    data: {
      organizationId,
      supplierId: input.supplierId,
      createdByUserId: userId,
      notes: input.notes ?? null,
      expectedDelivery: input.expectedDelivery ?? null,
      items: {
        create: input.items.map((i) => ({
          organizationId,
          productId: i.productId,
          orderedQtyPurchase: i.orderedQtyPurchase,
          unitCostCents: i.unitCostCents,
        })),
      },
    },
    include: { items: true, supplier: true },
  });

  if (input.createPayable) {
    const due = input.expectedDelivery ?? new Date();
    await db.payable.create({
      data: {
        organizationId,
        supplierId: input.supplierId,
        purchaseOrderId: order.id,
        description: `Pedido de compra #${order.id.slice(-6)}`,
        amountCents: totalCents,
        competenceDate: new Date(),
        dueDate: due,
      },
    });
  }

  return order;
}

export async function sendPurchaseOrder(db: TenantClient, orderId: string) {
  return db.purchaseOrder.update({
    where: { id: orderId },
    data: { status: "ENVIADO", sentAt: new Date() },
  });
}

export async function receivePurchaseOrder(
  db: TenantClient,
  organizationId: string,
  userId: string,
  orderId: string,
  lines: ReceiveLineInput[],
  toLocationId: string,
) {
  const order = await db.purchaseOrder.findFirstOrThrow({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });

  for (const line of lines) {
    const item = order.items.find((i) => i.id === line.orderItemId);
    if (!item) throw new Error("Item do pedido não encontrado");

    const remaining = item.orderedQtyPurchase - item.receivedQtyPurchase;
    if (line.qtyPurchase > remaining) {
      throw new Error(`Quantidade excede pendente do item ${item.product.name}`);
    }

    const consumeQty = purchaseToConsumeQty(
      line.qtyPurchase,
      item.product.conversionFactor,
    );
    const unitCost = purchaseUnitCostToConsumeUnitCost(
      item.unitCostCents,
      item.product.conversionFactor,
    );

    let batchId: string | null = null;
    if (line.batchNumber || item.product.requiresBatchExpiry) {
      if (!line.batchNumber) {
        throw new Error(`Lote obrigatório para ${item.product.name}`);
      }
      const batch = await findOrCreateBatch(
        db,
        organizationId,
        item.productId,
        line.batchNumber,
        line.expiryDate,
      );
      batchId = batch.id;
    }

    await createStockMovement(db, organizationId, {
      movementType: "ENTRADA_COMPRA",
      productId: item.productId,
      batchId,
      toLocationId,
      quantity: consumeQty,
      unitCostCents: unitCost,
      userId,
      purchaseOrderId: orderId,
      purchaseOrderItemId: item.id,
    });

    await db.purchaseOrderItem.update({
      where: { id: item.id },
      data: { receivedQtyPurchase: { increment: line.qtyPurchase } },
    });
  }

  const refreshed = await db.purchaseOrder.findFirstOrThrow({
    where: { id: orderId },
    include: { items: true },
  });

  const allReceived = refreshed.items.every(
    (i) => i.receivedQtyPurchase >= i.orderedQtyPurchase,
  );
  const anyReceived = refreshed.items.some((i) => i.receivedQtyPurchase > 0);

  await db.purchaseOrder.update({
    where: { id: orderId },
    data: {
      status: allReceived
        ? "RECEBIDO"
        : anyReceived
          ? "RECEBIDO_PARCIAL"
          : refreshed.status,
    },
  });

  return refreshed;
}

export async function suggestPurchaseItems(db: TenantClient) {
  const products = await db.product.findMany({
    where: { isActive: true },
  });

  const suggestions = [];
  for (const p of products) {
    const agg = await db.stockBalance.aggregate({
      where: { productId: p.id },
      _sum: { quantity: true },
    });
    const qty = agg._sum.quantity ?? 0;
    if (qty < p.minStock) {
      const neededConsume = p.minStock - qty;
      const purchaseQty = Math.ceil(neededConsume / p.conversionFactor);
      suggestions.push({
        product: p,
        currentQty: qty,
        suggestedPurchaseQty: purchaseQty,
        estimatedCostCents: purchaseQty * p.averageCostCents * p.conversionFactor,
      });
    }
  }
  return suggestions;
}

export async function listPurchaseOrders(db: TenantClient) {
  return db.purchaseOrder.findMany({
    include: {
      supplier: true,
      items: { include: { product: true } },
      payable: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
