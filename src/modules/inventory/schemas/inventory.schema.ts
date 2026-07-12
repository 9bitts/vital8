import { z } from "zod";

export const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  productType: z.enum(["MATERIAL", "MEDICAMENTO", "INSUMO", "REVENDA"]),
  purchaseUnit: z.string().optional(),
  consumeUnit: z.string().optional(),
  conversionFactor: z.coerce.number().int().min(1).optional(),
  barcode: z.string().optional(),
  minStock: z.coerce.number().int().min(0).optional(),
  maxStock: z.coerce.number().int().optional().nullable(),
  salePriceCents: z.coerce.number().int().optional().nullable(),
  isControlled: z.boolean().optional(),
  controlledList: z.enum(["A", "B", "C"]).optional().nullable(),
  requiresBatchExpiry: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const movementSchema = z.object({
  movementType: z.enum([
    "ENTRADA_AJUSTE",
    "SAIDA_CONSUMO",
    "SAIDA_VENDA",
    "SAIDA_PERDA",
    "SAIDA_VENCIMENTO",
    "TRANSFERENCIA",
  ]),
  productId: z.string(),
  batchId: z.string().optional().nullable(),
  batchNumber: z.string().optional(),
  expiryDate: z.coerce.date().optional().nullable(),
  fromLocationId: z.string().optional().nullable(),
  toLocationId: z.string().optional().nullable(),
  quantity: z.coerce.number().int().positive(),
  unitCostCents: z.coerce.number().int().optional(),
  reason: z.string().optional(),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string(),
  notes: z.string().optional(),
  expectedDelivery: z.coerce.date().optional(),
  createPayable: z.boolean().optional(),
  items: z.array(
    z.object({
      productId: z.string(),
      orderedQtyPurchase: z.coerce.number().int().positive(),
      unitCostCents: z.coerce.number().int().min(0),
    }),
  ).min(1),
});

export const receivePurchaseSchema = z.object({
  orderId: z.string(),
  toLocationId: z.string(),
  lines: z.array(
    z.object({
      orderItemId: z.string(),
      qtyPurchase: z.coerce.number().int().positive(),
      batchNumber: z.string().optional(),
      expiryDate: z.coerce.date().optional().nullable(),
    }),
  ).min(1),
});

export const kitSchema = z.object({
  serviceId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.coerce.number().int().positive(),
    }),
  ),
});

export const inventoryCountSchema = z.object({
  countId: z.string(),
  countedQty: z.coerce.number().int().min(0),
});
