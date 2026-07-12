import type { TenantClient } from "@/lib/db/tenant-client";
import { proportionalPackageRefund } from "@/lib/money";

export async function purchasePackage(
  db: TenantClient,
  organizationId: string,
  userId: string,
  input: {
    patientId: string;
    packageId: string;
    cashRegisterId: string;
    paymentMethod: import("@/generated/prisma/client").PaymentMethod;
  },
) {
  const pkg = await db.package.findFirstOrThrow({
    where: { id: input.packageId, isActive: true },
  });

  const sale = await db.sale.create({
    data: {
      organizationId,
      patientId: input.patientId,
      status: "CONFIRMADA",
      subtotalCents: pkg.priceCents,
      totalCents: pkg.priceCents,
      createdByUserId: userId,
      items: {
        create: {
          organizationId,
          itemType: "PACKAGE",
          packageId: pkg.id,
          description: pkg.name,
          quantity: 1,
          unitPriceCents: pkg.priceCents,
          totalCents: pkg.priceCents,
        },
      },
    },
  });

  const purchase = await db.packagePurchase.create({
    data: {
      organizationId,
      patientId: input.patientId,
      packageId: pkg.id,
      saleId: sale.id,
      sessionsTotal: pkg.sessionCount,
      sessionsUsed: 0,
      status: "ATIVO",
    },
  });

  const dueDate = new Date();
  const receivable = await db.receivable.create({
    data: {
      organizationId,
      patientId: input.patientId,
      saleId: sale.id,
      origin: "SALE",
      description: `Pacote ${pkg.name}`,
      totalCents: pkg.priceCents,
      dueDate,
    },
  });

  const payment = await db.payment.create({
    data: {
      organizationId,
      patientId: input.patientId,
      receivableId: receivable.id,
      saleId: sale.id,
      amountCents: pkg.priceCents,
      netAmountCents: pkg.priceCents,
      method: input.paymentMethod,
      cashRegisterId: input.cashRegisterId,
      createdByUserId: userId,
    },
  });

  await db.cashRegisterEntry.create({
    data: {
      organizationId,
      cashRegisterId: input.cashRegisterId,
      entryType: "PAGAMENTO",
      amountCents: pkg.priceCents,
      paymentId: payment.id,
      createdByUserId: userId,
    },
  });

  await db.receivable.update({
    where: { id: receivable.id },
    data: { paidCents: pkg.priceCents, status: "PAGO" },
  });

  return { sale, purchase, receivable, payment };
}

export async function consumePackageSession(
  db: TenantClient,
  organizationId: string,
  appointmentId: string,
) {
  const appt = await db.appointment.findFirstOrThrow({
    where: { id: appointmentId },
  });

  const active = await db.packagePurchase.findMany({
    where: { patientId: appt.patientId, status: "ATIVO" },
    orderBy: { createdAt: "asc" },
  });

  const available = active.find((p) => p.sessionsUsed < p.sessionsTotal);
  if (!available) return null;

  const existing = await db.packageSessionConsumption.findFirst({
    where: { appointmentId },
  });
  if (existing) return existing;

  await db.packageSessionConsumption.create({
    data: {
      organizationId,
      purchaseId: available.id,
      appointmentId,
    },
  });

  const used = available.sessionsUsed + 1;
  const status = used >= available.sessionsTotal ? "ESGOTADO" : "ATIVO";

  return db.packagePurchase.update({
    where: { id: available.id },
    data: { sessionsUsed: used, status },
  });
}

export async function cancelPackagePurchase(
  db: TenantClient,
  purchaseId: string,
) {
  const purchase = await db.packagePurchase.findFirstOrThrow({
    where: { id: purchaseId },
    include: { package: true, sale: true },
  });

  const refundCents = proportionalPackageRefund(
    purchase.package.priceCents,
    purchase.sessionsTotal,
    purchase.sessionsUsed,
  );

  await db.packagePurchase.update({
    where: { id: purchaseId },
    data: { status: "CANCELADO" },
  });

  return { refundCents, purchase };
}

export async function listPatientPackageBalances(
  db: TenantClient,
  patientId: string,
) {
  return db.packagePurchase.findMany({
    where: { patientId, status: { in: ["ATIVO", "ESGOTADO"] } },
    include: { package: true },
    orderBy: { createdAt: "desc" },
  });
}
