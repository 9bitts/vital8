import type { StockMovementType } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";

export type OrgInventorySettings = {
  allowNegativeStock?: boolean;
  expiryAlertDays?: number[];
};

export function getOrgInventorySettings(
  settings: unknown,
): OrgInventorySettings {
  const s = (settings ?? {}) as Record<string, unknown>;
  const inv = (s.inventory ?? {}) as Record<string, unknown>;
  return {
    allowNegativeStock: Boolean(inv.allowNegativeStock),
    expiryAlertDays: Array.isArray(inv.expiryAlertDays)
      ? (inv.expiryAlertDays as number[])
      : [30, 60, 90],
  };
}

export async function getOrgSettings(organizationId: string) {
  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: organizationId },
  });
  return getOrgInventorySettings(org.settings);
}

export function purchaseToConsumeQty(
  purchaseQty: number,
  conversionFactor: number,
): number {
  return purchaseQty * conversionFactor;
}

export function purchaseUnitCostToConsumeUnitCost(
  purchaseUnitCostCents: number,
  conversionFactor: number,
): number {
  if (conversionFactor <= 0) return purchaseUnitCostCents;
  return Math.round(purchaseUnitCostCents / conversionFactor);
}

export function isInboundMovement(type: StockMovementType): boolean {
  return type === "ENTRADA_COMPRA" || type === "ENTRADA_AJUSTE";
}

export function isOutboundMovement(type: StockMovementType): boolean {
  return (
    type === "SAIDA_CONSUMO" ||
    type === "SAIDA_VENDA" ||
    type === "SAIDA_PERDA" ||
    type === "SAIDA_VENCIMENTO"
  );
}

export function requiresReason(type: StockMovementType): boolean {
  return (
    type === "ENTRADA_AJUSTE" ||
    type === "SAIDA_PERDA" ||
    type === "AJUSTE_INVENTARIO" ||
    type === "ESTORNO"
  );
}

export function recalculateMovingAverage(
  currentQty: number,
  currentAvgCents: number,
  incomingQty: number,
  incomingUnitCostCents: number,
): number {
  if (incomingQty <= 0) return currentAvgCents;
  const totalQty = currentQty + incomingQty;
  if (totalQty <= 0) return incomingUnitCostCents;
  return Math.round(
    (currentQty * currentAvgCents + incomingQty * incomingUnitCostCents) /
      totalQty,
  );
}

export type FEFOBatch = {
  batchId: string;
  quantity: number;
  expiryDate: Date | null;
};

/** Ordena lotes para consumo FEFO (validade mais próxima primeiro). */
export function sortForFEFO(batches: FEFOBatch[]): FEFOBatch[] {
  return [...batches]
    .filter((b) => b.quantity > 0)
    .sort((a, b) => {
      const ta = a.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const tb = b.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
}

/** Planeja baixa FEFO; retorna alocações e quantidade ainda pendente. */
export function planFEFOAllocation(
  batches: FEFOBatch[],
  quantityNeeded: number,
): { allocations: Array<{ batchId: string; take: number }>; remaining: number } {
  const sorted = sortForFEFO(batches);
  let remaining = quantityNeeded;
  const allocations: Array<{ batchId: string; take: number }> = [];
  for (const batch of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    allocations.push({ batchId: batch.batchId, take });
    remaining -= take;
  }
  return { allocations, remaining };
}
