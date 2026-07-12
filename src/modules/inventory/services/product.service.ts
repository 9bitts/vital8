import type { ProductType, ControlledList } from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { getProductTotalQty } from "./movement.service";

export type ProductInput = {
  id?: string;
  name: string;
  productType: ProductType;
  purchaseUnit?: string;
  consumeUnit?: string;
  conversionFactor?: number;
  barcode?: string;
  minStock?: number;
  maxStock?: number | null;
  salePriceCents?: number | null;
  isControlled?: boolean;
  controlledList?: ControlledList | null;
  requiresBatchExpiry?: boolean;
  isActive?: boolean;
};

export async function listProducts(
  db: TenantClient,
  query?: string,
  branchId?: string | null,
) {
  if (!branchId) {
    return db.product.findMany({
      where: {
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { barcode: { contains: query } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  const balances = await db.stockBalance.findMany({
    where: { location: { branchId } },
    select: { productId: true },
    distinct: ["productId"],
  });
  const productIds = balances.map((b) => b.productId);

  return db.product.findMany({
    where: {
      id: { in: productIds.length > 0 ? productIds : ["__none__"] },
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { barcode: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function getProductWithBalances(db: TenantClient, productId: string) {
  const product = await db.product.findFirstOrThrow({
    where: { id: productId },
  });
  const balances = await db.stockBalance.findMany({
    where: { productId },
    include: { location: true, batch: true },
  });
  const totalQty = balances.reduce((s, b) => s + b.quantity, 0);
  return { product, balances, totalQty };
}

export async function upsertProduct(
  db: TenantClient,
  organizationId: string,
  input: ProductInput,
) {
  const data = {
    organizationId,
    name: input.name,
    productType: input.productType,
    purchaseUnit: input.purchaseUnit ?? "UN",
    consumeUnit: input.consumeUnit ?? "UN",
    conversionFactor: input.conversionFactor ?? 1,
    barcode: input.barcode ?? null,
    minStock: input.minStock ?? 0,
    maxStock: input.maxStock ?? null,
    salePriceCents: input.salePriceCents ?? null,
    isControlled: input.isControlled ?? false,
    controlledList: input.controlledList ?? null,
    requiresBatchExpiry: input.requiresBatchExpiry ?? false,
    isActive: input.isActive ?? true,
  };

  if (input.id) {
    return db.product.update({ where: { id: input.id }, data });
  }
  return db.product.create({ data });
}

export async function findProductByBarcode(db: TenantClient, barcode: string) {
  return db.product.findFirst({
    where: { barcode, isActive: true },
    include: {
      balances: { include: { location: true, batch: true } },
    },
  });
}

export async function getProductsWithStockSummary(db: TenantClient) {
  const products = await db.product.findMany({ where: { isActive: true } });
  const result = [];
  for (const p of products) {
    const totalQty = await getProductTotalQty(db, p.id);
    result.push({ ...p, totalQty, belowMin: totalQty < p.minStock });
  }
  return result;
}
