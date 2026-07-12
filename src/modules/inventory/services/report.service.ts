import type { TenantClient } from "@/lib/db/tenant-client";

export async function getAbcCurve(db: TenantClient, from: Date, to: Date) {
  const movements = await db.stockMovement.findMany({
    where: {
      movementType: { in: ["SAIDA_CONSUMO", "SAIDA_VENDA"] },
      createdAt: { gte: from, lte: to },
    },
    include: { product: true },
  });

  const byProduct = new Map<string, { name: string; valueCents: number }>();
  for (const m of movements) {
    const val = m.quantity * m.unitCostCents;
    const cur = byProduct.get(m.productId) ?? {
      name: m.product.name,
      valueCents: 0,
    };
    cur.valueCents += val;
    byProduct.set(m.productId, cur);
  }

  const sorted = Array.from(byProduct.entries())
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.valueCents - a.valueCents);

  const total = sorted.reduce((s, i) => s + i.valueCents, 0);
  let cumulative = 0;
  return sorted.map((item) => {
    cumulative += item.valueCents;
    const pct = total > 0 ? (item.valueCents / total) * 100 : 0;
    const cumPct = total > 0 ? (cumulative / total) * 100 : 0;
    let cls = "C";
    if (cumPct <= 80) cls = "A";
    else if (cumPct <= 95) cls = "B";
    return { ...item, pct, cumPct, class: cls };
  });
}

export async function getConsumptionByProfessional(
  db: TenantClient,
  from: Date,
  to: Date,
) {
  const movements = await db.stockMovement.findMany({
    where: {
      movementType: "SAIDA_CONSUMO",
      createdAt: { gte: from, lte: to },
      appointmentId: { not: null },
    },
    include: {
      product: true,
      appointment: { include: { professional: true, service: true } },
    },
  });

  const map = new Map<
    string,
    {
      professional: string;
      items: Array<{ product: string; qty: number; costCents: number }>;
    }
  >();

  for (const m of movements) {
    const prof = m.appointment?.professional.displayName ?? "—";
    const key = m.appointment?.professionalId ?? "unknown";
    const entry = map.get(key) ?? { professional: prof, items: [] };
    entry.items.push({
      product: m.product.name,
      qty: m.quantity,
      costCents: m.quantity * m.unitCostCents,
    });
    map.set(key, entry);
  }

  return Array.from(map.values());
}

export async function getLossesByReason(db: TenantClient, from: Date, to: Date) {
  const movements = await db.stockMovement.findMany({
    where: {
      movementType: "SAIDA_PERDA",
      createdAt: { gte: from, lte: to },
    },
    include: { product: true },
  });

  const map = new Map<string, { reason: string; totalCents: number; count: number }>();
  for (const m of movements) {
    const reason = m.reason ?? "Sem motivo";
    const cur = map.get(reason) ?? { reason, totalCents: 0, count: 0 };
    cur.totalCents += m.quantity * m.unitCostCents;
    cur.count += 1;
    map.set(reason, cur);
  }
  return Array.from(map.values());
}

export async function getMaterialCostPerAppointment(
  db: TenantClient,
  appointmentId: string,
) {
  const movements = await db.stockMovement.findMany({
    where: { appointmentId, movementType: "SAIDA_CONSUMO" },
    include: { product: true },
  });
  const costCents = movements.reduce(
    (s, m) => s + m.quantity * m.unitCostCents,
    0,
  );
  const appt = await db.appointment.findFirst({
    where: { id: appointmentId },
    include: { sale: true, service: true },
  });
  const revenueCents = appt?.sale?.totalCents ?? 0;
  return {
    appointmentId,
    costCents,
    revenueCents,
    marginCents: revenueCents - costCents,
    items: movements,
  };
}

export async function getControlledSubstancesBook(
  db: TenantClient,
  from: Date,
  to: Date,
) {
  const products = await db.product.findMany({
    where: { isControlled: true, isActive: true },
  });
  const productIds = products.map((p) => p.id);

  const movements = await db.stockMovement.findMany({
    where: {
      productId: { in: productIds },
      createdAt: { gte: from, lte: to },
    },
    include: { product: true, batch: true, fromLocation: true, toLocation: true },
    orderBy: [{ productId: "asc" }, { createdAt: "asc" }],
  });

  const lines = [];
  for (const pid of productIds) {
    const productMovements = movements.filter((m) => m.productId === pid);
    let running = 0;
    for (const m of productMovements) {
      const prev = running;
      const inQty =
        m.toLocationId && (m.movementType.startsWith("ENTRADA") || m.movementType === "TRANSFERENCIA")
          ? m.quantity
          : 0;
      const outQty =
        m.fromLocationId && m.movementType.startsWith("SAIDA")
          ? m.quantity
          : m.movementType === "TRANSFERENCIA"
            ? m.quantity
            : 0;
      running += inQty - outQty;
      lines.push({
        date: m.createdAt,
        product: m.product.name,
        controlledList: m.product.controlledList,
        batchNumber: m.batch?.batchNumber ?? "—",
        movementType: m.movementType,
        quantity: m.quantity,
        balanceBefore: prev,
        balanceAfter: running,
        reason: m.reason,
        userId: m.userId,
      });
    }
  }
  return lines;
}
