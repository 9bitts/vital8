import type { PrismaClient } from "../src/generated/prisma/client";
import { adminPrisma } from "../src/lib/db/admin-client";
import { createStockMovement } from "../src/modules/inventory/services/movement.service";
import { createTenantClient } from "../src/lib/db/tenant-client";
import { saveServiceKit } from "../src/modules/inventory/services/kit.service";
import {
  closeInventory,
  openInventory,
  recordCount,
} from "../src/modules/inventory/services/inventory-count.service";
import { createPurchaseOrder, receivePurchaseOrder } from "../src/modules/inventory/services/purchase.service";
import { findOrCreateBatch } from "../src/modules/inventory/services/location.service";

const PRODUCTS = [
  { name: "Luva procedimento M", type: "INSUMO" as const, barcode: "7891000000011", min: 200, batch: false },
  { name: "Seringa 5ml", type: "INSUMO" as const, barcode: "7891000000028", min: 100, batch: false },
  { name: "Algodão hidrófilo 500g", type: "MATERIAL" as const, barcode: "7891000000035", min: 10, batch: false },
  { name: "Álcool 70% 1L", type: "INSUMO" as const, barcode: "7891000000042", min: 20, batch: true },
  { name: "Gaze estéril", type: "MATERIAL" as const, barcode: "7891000000059", min: 50, batch: false },
  { name: "Dipirona 500mg amp", type: "MEDICAMENTO" as const, barcode: "7891000000066", min: 30, batch: true, controlled: true, list: "B" as const },
  { name: "Midazolam 5mg/ml", type: "MEDICAMENTO" as const, barcode: "7891000000073", min: 5, batch: true, controlled: true, list: "A" as const },
  { name: "Máscara cirúrgica", type: "INSUMO" as const, barcode: "7891000000080", min: 100, batch: false },
  { name: "Termômetro digital", type: "REVENDA" as const, barcode: "7891000000097", min: 2, batch: false, sale: 4500 },
  { name: "Oxímetro pulso", type: "REVENDA" as const, barcode: "7891000000103", min: 1, batch: false, sale: 8900 },
  { name: "Agulha 25x7", type: "INSUMO" as const, barcode: "7891000000110", min: 200, batch: false },
  { name: "Tubo EDTA", type: "INSUMO" as const, barcode: "7891000000127", min: 80, batch: true },
  { name: "Atadura crepe", type: "MATERIAL" as const, barcode: "7891000000134", min: 15, batch: false },
  { name: "Esparadrapo", type: "MATERIAL" as const, barcode: "7891000000141", min: 20, batch: false },
  { name: "Soro fisiológico 500ml", type: "MEDICAMENTO" as const, barcode: "7891000000158", min: 40, batch: true },
  { name: "Lanceta", type: "INSUMO" as const, barcode: "7891000000165", min: 150, batch: false },
  { name: "Tira glicemia", type: "INSUMO" as const, barcode: "7891000000172", min: 100, batch: true },
  { name: "Kit curativo", type: "MATERIAL" as const, barcode: "7891000000189", min: 25, batch: false },
  { name: "Vacina influenza (dose)", type: "MEDICAMENTO" as const, barcode: "7891000000196", min: 10, batch: true },
  { name: "Papel grau cirúrgico", type: "MATERIAL" as const, barcode: "7891000000202", min: 5, batch: false },
];

export async function seedInventory(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
) {
  const db = createTenantClient(orgId);
  const rooms = await prisma.room.findMany({ where: { organizationId: orgId }, take: 2 });
  const services = await prisma.service.findMany({ where: { organizationId: orgId }, take: 3 });

  const central = await prisma.stockLocation.create({
    data: { organizationId: orgId, name: "Estoque Central", isCentral: true },
  });

  const locs = [central];
  for (const room of rooms) {
    locs.push(
      await prisma.stockLocation.create({
        data: {
          organizationId: orgId,
          name: `Sala ${room.name}`,
          roomId: room.id,
        },
      }),
    );
  }

  await prisma.stockLocation.create({
    data: {
      organizationId: orgId,
      name: "Geladeira medicamentos",
      temperatureControlled: true,
    },
  });

  let supplier = await prisma.supplier.findFirst({ where: { organizationId: orgId } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        organizationId: orgId,
        name: "Distribuidora MedSupply",
        email: "compras@medsupply.local",
        deliveryTermDays: 5,
        paymentTerms: "30 dias",
      },
    });
  } else {
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { deliveryTermDays: 5, paymentTerms: "30 dias" },
    });
  }

  const productRecords = [];
  for (const p of PRODUCTS) {
    const prod = await prisma.product.create({
      data: {
        organizationId: orgId,
        name: p.name,
        productType: p.type,
        barcode: p.barcode,
        minStock: p.min,
        requiresBatchExpiry: p.batch,
        isControlled: p.controlled ?? false,
        controlledList: p.list ?? null,
        salePriceCents: p.sale ?? null,
        conversionFactor: p.name.includes("Luva") ? 100 : 1,
        purchaseUnit: p.name.includes("Luva") ? "CX" : "UN",
      },
    });
    productRecords.push(prod);

    const batch = p.batch
      ? await findOrCreateBatch(db, orgId, prod.id, `L${prod.id.slice(-4)}`, new Date("2026-12-31"))
      : null;

    await createStockMovement(db, orgId, {
      movementType: "ENTRADA_AJUSTE",
      productId: prod.id,
      batchId: batch?.id,
      toLocationId: central.id,
      quantity: p.min * 2,
      unitCostCents: 500 + productRecords.length * 100,
      reason: "Saldo inicial seed",
      userId,
    });
  }

  if (services.length >= 3) {
    await saveServiceKit(db, orgId, services[0]!.id, [
      { productId: productRecords[0]!.id, quantity: 2 },
      { productId: productRecords[1]!.id, quantity: 1 },
    ]);
    await saveServiceKit(db, orgId, services[1]!.id, [
      { productId: productRecords[4]!.id, quantity: 1 },
      { productId: productRecords[3]!.id, quantity: 1 },
    ]);
    await saveServiceKit(db, orgId, services[2]!.id, [
      { productId: productRecords[7]!.id, quantity: 1 },
    ]);
  }

  const order = await createPurchaseOrder(db, orgId, userId, {
    supplierId: supplier.id,
    createPayable: true,
    items: [
      {
        productId: productRecords[2]!.id,
        orderedQtyPurchase: 10,
        unitCostCents: 2500,
      },
      {
        productId: productRecords[5]!.id,
        orderedQtyPurchase: 5,
        unitCostCents: 800,
      },
    ],
  });

  await prisma.purchaseOrder.update({
    where: { id: order.id },
    data: { status: "ENVIADO", sentAt: new Date() },
  });

  await receivePurchaseOrder(db, orgId, userId, order.id, [
    {
      orderItemId: order.items[0]!.id,
      qtyPurchase: 6,
      batchNumber: "RCV-001",
      expiryDate: new Date("2027-06-30"),
    },
  ], central.id);

  const inv = await openInventory(db, orgId, central.id, userId);
  const firstCount = inv.counts[0];
  if (firstCount) {
    await recordCount(db, firstCount.id, (firstCount.expectedQty ?? 0) - 2);
  }
  await closeInventory(db, orgId, inv.id, userId);

  void adminPrisma;
}
