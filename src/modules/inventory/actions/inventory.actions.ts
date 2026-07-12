"use server";

import { revalidatePath } from "next/cache";
import { adminPrisma } from "@/lib/db/admin-client";
import {
  type ActionResult,
  AuthError,
  requireAuth,
} from "@/lib/auth/guards";
import { hasFeature } from "@/lib/features/features.service";
import {
  canAdjustInventory,
  canManageInventory,
  canViewControlledReport,
} from "../lib/permissions";
import {
  kitSchema,
  movementSchema,
  productSchema,
  purchaseOrderSchema,
  receivePurchaseSchema,
  inventoryCountSchema,
} from "../schemas/inventory.schema";
import { getDashboardSummary } from "../services/alerts.service";
import {
  closeInventory,
  getInventoryDivergences,
  listInventories,
  openInventory,
  recordCount,
} from "../services/inventory-count.service";
import {
  consumeKitForAppointment,
  previewAppointmentConsumption,
  saveServiceKit,
} from "../services/kit.service";
import { listLocations } from "../services/location.service";
import {
  createStockMovement,
  getKardex,
} from "../services/movement.service";
import {
  findProductByBarcode,
  getProductWithBalances,
  listProducts,
  upsertProduct,
} from "../services/product.service";
import {
  createPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrder,
  sendPurchaseOrder,
  suggestPurchaseItems,
} from "../services/purchase.service";
import {
  getAbcCurve,
  getControlledSubstancesBook,
  getConsumptionByProfessional,
  getLossesByReason,
  getMaterialCostPerAppointment,
} from "../services/report.service";
import { findOrCreateBatch } from "../services/location.service";
import { getPurchaseEmailAdapter } from "@/lib/integrations/purchase-email";

async function requireInventory(ctx: Awaited<ReturnType<typeof requireAuth>>) {
  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: ctx.organizationId },
  });
  if (!hasFeature(org.plan, "inventory")) {
    throw new AuthError("Módulo estoque não disponível no plano", "FORBIDDEN");
  }
}

export async function getDashboardAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE", "FINANCEIRO", "RECEPCAO"]);
  await requireInventory(ctx);
  return getDashboardSummary(ctx.db, ctx.organizationId);
}

export async function listProductsAction(query?: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE", "FINANCEIRO", "RECEPCAO"]);
  await requireInventory(ctx);
  return listProducts(ctx.db, query);
}

export async function saveProductAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
    await requireInventory(ctx);
    if (!canManageInventory(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    await upsertProduct(ctx.db, ctx.organizationId, productSchema.parse(input));
    revalidatePath("/app/estoque");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function getProductDetailAction(productId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE", "FINANCEIRO", "RECEPCAO"]);
  await requireInventory(ctx);
  const detail = await getProductWithBalances(ctx.db, productId);
  const kardex = await getKardex(ctx.db, productId);
  return { ...detail, kardex };
}

export async function registerMovementAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
    await requireInventory(ctx);
    if (!canManageInventory(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    const parsed = movementSchema.parse(input);

    let batchId = parsed.batchId ?? null;
    if (parsed.batchNumber) {
      const batch = await findOrCreateBatch(
        ctx.db,
        ctx.organizationId,
        parsed.productId,
        parsed.batchNumber,
        parsed.expiryDate,
      );
      batchId = batch.id;
    }

    await createStockMovement(ctx.db, ctx.organizationId, {
      movementType: parsed.movementType,
      productId: parsed.productId,
      batchId,
      fromLocationId: parsed.fromLocationId,
      toLocationId: parsed.toLocationId,
      quantity: parsed.quantity,
      unitCostCents: parsed.unitCostCents,
      reason: parsed.reason,
      userId: ctx.userId,
    });
    revalidatePath("/app/estoque");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function lookupBarcodeAction(barcode: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
  await requireInventory(ctx);
  return findProductByBarcode(ctx.db, barcode);
}

export async function listLocationsAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE", "FINANCEIRO", "RECEPCAO"]);
  await requireInventory(ctx);
  return listLocations(ctx.db);
}

export async function createPurchaseOrderAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE", "FINANCEIRO"]);
    await requireInventory(ctx);
    const parsed = purchaseOrderSchema.parse(input);
    const order = await createPurchaseOrder(ctx.db, ctx.organizationId, ctx.userId, parsed);
    revalidatePath("/app/estoque/compras");
    return { success: true, data: { id: order.id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function sendPurchaseOrderAction(orderId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
    await requireInventory(ctx);
    const order = await ctx.db.purchaseOrder.findFirstOrThrow({
      where: { id: orderId },
      include: { supplier: true },
    });
    await sendPurchaseOrder(ctx.db, orderId);
    if (order.supplier.email) {
      const adapter = getPurchaseEmailAdapter();
      await adapter.sendPurchaseOrderPdf(
        order.supplier.email,
        `Pedido de compra ${order.id.slice(-6)}`,
        `Pedido ${order.id}`,
        { orderId: order.id },
      );
    }
    revalidatePath("/app/estoque/compras");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function receivePurchaseAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
    await requireInventory(ctx);
    const parsed = receivePurchaseSchema.parse(input);
    await receivePurchaseOrder(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      parsed.orderId,
      parsed.lines,
      parsed.toLocationId,
    );
    revalidatePath("/app/estoque/compras");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listPurchasesAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE", "FINANCEIRO"]);
  await requireInventory(ctx);
  return listPurchaseOrders(ctx.db);
}

export async function suggestPurchasesAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
  await requireInventory(ctx);
  return suggestPurchaseItems(ctx.db);
}

export async function saveKitAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
    await requireInventory(ctx);
    const parsed = kitSchema.parse(input);
    await saveServiceKit(ctx.db, ctx.organizationId, parsed.serviceId, parsed.items);
    revalidatePath("/app/configuracoes/servicos");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function previewConsumptionAction(appointmentId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE", "RECEPCAO", "FINANCEIRO"]);
  await requireInventory(ctx);
  return previewAppointmentConsumption(ctx.db, appointmentId);
}

export async function openInventoryAction(locationId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
    await requireInventory(ctx);
    if (!canAdjustInventory(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    const inv = await openInventory(ctx.db, ctx.organizationId, locationId, ctx.userId);
    revalidatePath("/app/estoque/inventario");
    return { success: true, data: { id: inv.id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function recordInventoryCountAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
    await requireInventory(ctx);
    const parsed = inventoryCountSchema.parse(input);
    await recordCount(ctx.db, parsed.countId, parsed.countedQty);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function closeInventoryAction(inventoryId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
    await requireInventory(ctx);
    if (!canAdjustInventory(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    await closeInventory(ctx.db, ctx.organizationId, inventoryId, ctx.userId);
    revalidatePath("/app/estoque/inventario");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listInventoriesAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
  await requireInventory(ctx);
  return listInventories(ctx.db);
}

export async function getInventoryDivergencesAction(inventoryId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
  await requireInventory(ctx);
  return getInventoryDivergences(ctx.db, inventoryId);
}

export async function getReportsAction(periodDays = 30) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE", "FINANCEIRO"]);
  await requireInventory(ctx);
  const to = new Date();
  const from = new Date(Date.now() - periodDays * 86400000);
  const [abc, byProf, losses] = await Promise.all([
    getAbcCurve(ctx.db, from, to),
    getConsumptionByProfessional(ctx.db, from, to),
    getLossesByReason(ctx.db, from, to),
  ]);
  return { abc, byProf, losses, from, to };
}

export async function getControlledBookAction(from: Date, to: Date) {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  await requireInventory(ctx);
  if (!canViewControlledReport(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
  return getControlledSubstancesBook(ctx.db, from, to);
}

export async function getAppointmentMaterialsAction(appointmentId: string) {
  const ctx = await requireAuth();
  await requireInventory(ctx);
  return getMaterialCostPerAppointment(ctx.db, appointmentId);
}

export async function getEncounterMaterialsAction(encounterId: string) {
  const ctx = await requireAuth();
  await requireInventory(ctx);
  const encounter = await ctx.db.encounter.findFirstOrThrow({
    where: { id: encounterId },
    select: { appointmentId: true },
  });
  if (!encounter.appointmentId) {
    return { appointmentId: null, costCents: 0, revenueCents: 0, marginCents: 0, items: [] };
  }
  return getMaterialCostPerAppointment(ctx.db, encounter.appointmentId);
}

/** Hook pós-finalização */
export async function onAppointmentFinalizedInventory(
  db: Parameters<typeof consumeKitForAppointment>[0],
  organizationId: string,
  userId: string,
  appointmentId: string,
) {
  const org = await adminPrisma.organization.findFirst({ where: { id: organizationId } });
  if (!org || !hasFeature(org.plan, "inventory")) return [];
  return consumeKitForAppointment(db, organizationId, userId, appointmentId);
}

export async function listServicesForKitAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
  await requireInventory(ctx);
  return ctx.db.service.findMany({
    where: { isActive: true },
    include: { consumptionKit: { include: { items: { include: { product: true } } } } },
    orderBy: { name: "asc" },
  });
}
