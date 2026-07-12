import type { PaymentMethod, ReceivableStatus } from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import {
  allocateDiscount,
  calculateNetAmount,
  splitInstallments,
  sumCents,
} from "@/lib/money";
import { resolveServicePriceCents } from "./price-table.service";
import { consumePackageSession } from "./package.service";

export type SaleItemInput = {
  itemType?: "SERVICE" | "PACKAGE" | "PRODUCT";
  serviceId?: string | null;
  packageId?: string | null;
  description: string;
  quantity?: number;
  unitPriceCents: number;
};

export type CheckoutInput = {
  appointmentId?: string | null;
  patientId: string;
  professionalId?: string | null;
  items: SaleItemInput[];
  discountCents?: number;
  discountReason?: string | null;
  discountAuthorizedByUserId?: string | null;
  paymentMethod: PaymentMethod;
  installmentCount?: number;
  creditCardInstallments?: number;
  feePercentBasisPoints?: number;
  cashRegisterId: string;
  emitNfse?: boolean;
};

export async function createSaleFromAppointment(
  db: TenantClient,
  organizationId: string,
  userId: string,
  appointmentId: string,
) {
  const existing = await db.appointment.findFirstOrThrow({
    where: { id: appointmentId },
    include: {
      patient: { include: { insurancePlans: { take: 1 } } },
      service: true,
    },
  });

  if (existing.saleId) {
    return db.sale.findFirstOrThrow({ where: { id: existing.saleId }, include: { items: true } });
  }

  const insurer = existing.patient.insurancePlans[0]?.insurerName ?? null;
  const priceCents = await resolveServicePriceCents(
    db,
    existing.serviceId,
    existing.isPrivate,
    insurer,
  );

  const sale = await db.sale.create({
    data: {
      organizationId,
      patientId: existing.patientId,
      professionalId: existing.professionalId,
      status: "RASCUNHO",
      subtotalCents: priceCents,
      totalCents: priceCents,
      createdByUserId: userId,
      items: {
        create: {
          organizationId,
          itemType: "SERVICE",
          serviceId: existing.serviceId,
          description: existing.service.name,
          quantity: 1,
          unitPriceCents: priceCents,
          totalCents: priceCents,
        },
      },
    },
    include: { items: true },
  });

  await db.appointment.update({
    where: { id: appointmentId },
    data: { saleId: sale.id },
  });

  return sale;
}

function computeSaleTotals(items: SaleItemInput[], discountCents: number) {
  const lineTotals = items.map(
    (i) => (i.quantity ?? 1) * i.unitPriceCents,
  );
  const subtotalCents = sumCents(lineTotals);
  const totalCents = Math.max(0, subtotalCents - discountCents);
  return { lineTotals, subtotalCents, totalCents };
}

export async function checkoutSale(
  db: TenantClient,
  organizationId: string,
  userId: string,
  input: CheckoutInput,
) {
  const discountCents = input.discountCents ?? 0;
  const { subtotalCents, totalCents } = computeSaleTotals(
    input.items,
    discountCents,
  );

  let sale = input.appointmentId
    ? await createSaleFromAppointment(db, organizationId, userId, input.appointmentId)
    : null;

  if (sale && sale.status === "CONFIRMADA") {
    throw new Error("Atendimento já possui venda confirmada");
  }

  if (sale) {
    await db.saleItem.deleteMany({ where: { saleId: sale.id } });
    sale = await db.sale.update({
      where: { id: sale.id },
      data: {
        subtotalCents,
        discountCents,
        totalCents,
        discountReason: input.discountReason ?? null,
        discountAuthorizedByUserId: input.discountAuthorizedByUserId ?? null,
        status: "CONFIRMADA",
        items: {
          create: input.items.map((item, i) => ({
            organizationId,
            itemType: item.itemType ?? "SERVICE",
            serviceId: item.serviceId ?? null,
            packageId: item.packageId ?? null,
            description: item.description,
            quantity: item.quantity ?? 1,
            unitPriceCents: item.unitPriceCents,
            totalCents: (item.quantity ?? 1) * item.unitPriceCents,
            sortOrder: i,
          })),
        },
      },
      include: { items: true },
    });
  } else {
    sale = await db.sale.create({
      data: {
        organizationId,
        patientId: input.patientId,
        professionalId: input.professionalId ?? null,
        status: "CONFIRMADA",
        subtotalCents,
        discountCents,
        totalCents,
        discountReason: input.discountReason ?? null,
        discountAuthorizedByUserId: input.discountAuthorizedByUserId ?? null,
        createdByUserId: userId,
        items: {
          create: input.items.map((item, i) => ({
            organizationId,
            itemType: item.itemType ?? "SERVICE",
            serviceId: item.serviceId ?? null,
            packageId: item.packageId ?? null,
            description: item.description,
            quantity: item.quantity ?? 1,
            unitPriceCents: item.unitPriceCents,
            totalCents: (item.quantity ?? 1) * item.unitPriceCents,
            sortOrder: i,
          })),
        },
      },
      include: { items: true },
    });
  }

  const installmentAmounts = splitInstallments(
    totalCents,
    input.installmentCount ?? 1,
  );
  const today = new Date();
  const receivables = [];

  for (let i = 0; i < installmentAmounts.length; i++) {
    const dueDate = new Date(today);
    dueDate.setMonth(dueDate.getMonth() + i);
    const recv = await db.receivable.create({
      data: {
        organizationId,
        patientId: input.patientId,
        saleId: sale.id,
        origin: "SALE",
        description: `Venda ${sale.id.slice(-6)} parcela ${i + 1}/${installmentAmounts.length}`,
        totalCents: installmentAmounts[i],
        dueDate,
        installmentNumber: i + 1,
        installmentCount: installmentAmounts.length,
      },
    });
    receivables.push(recv);
  }

  const firstReceivable = receivables[0];
  const payAmount = installmentAmounts[0];
  const { feeCents, netAmountCents } = calculateNetAmount(
    payAmount,
    input.feePercentBasisPoints ?? 0,
  );

  const payment = await db.payment.create({
    data: {
      organizationId,
      patientId: input.patientId,
      receivableId: firstReceivable.id,
      saleId: sale.id,
      amountCents: payAmount,
      netAmountCents,
      feePercent: input.feePercentBasisPoints ?? 0,
      feeCents,
      method: input.paymentMethod,
      creditCardInstallments: input.creditCardInstallments ?? 1,
      cashRegisterId: input.cashRegisterId,
      createdByUserId: userId,
    },
  });

  await db.cashRegisterEntry.create({
    data: {
      organizationId,
      cashRegisterId: input.cashRegisterId,
      entryType: "PAGAMENTO",
      amountCents: payAmount,
      paymentId: payment.id,
      createdByUserId: userId,
    },
  });

  await updateReceivableStatus(db, firstReceivable.id);

  if (input.appointmentId) {
    await consumePackageSession(db, organizationId, input.appointmentId);
  }

  return { sale, payment, receivables };
}

export async function updateReceivableStatus(
  db: TenantClient,
  receivableId: string,
) {
  const recv = await db.receivable.findFirstOrThrow({
    where: { id: receivableId },
    include: { payments: true },
  });

  const paidCents = sumCents(recv.payments.map((p) => p.amountCents));
  let status: ReceivableStatus = "ABERTO";

  if (paidCents >= recv.totalCents) status = "PAGO";
  else if (paidCents > 0) status = "PARCIAL";
  else if (new Date(recv.dueDate) < new Date()) status = "VENCIDO";

  return db.receivable.update({
    where: { id: receivableId },
    data: { paidCents, status },
  });
}

export async function registerPayment(
  db: TenantClient,
  organizationId: string,
  userId: string,
  input: {
    receivableId: string;
    amountCents: number;
    method: PaymentMethod;
    cashRegisterId: string;
    feePercentBasisPoints?: number;
  },
) {
  const recv = await db.receivable.findFirstOrThrow({
    where: { id: input.receivableId },
  });

  const remaining = recv.totalCents - recv.paidCents;
  if (input.amountCents > remaining) {
    throw new Error("Valor excede saldo da parcela");
  }

  const { feeCents, netAmountCents } = calculateNetAmount(
    input.amountCents,
    input.feePercentBasisPoints ?? 0,
  );

  const payment = await db.payment.create({
    data: {
      organizationId,
      patientId: recv.patientId,
      receivableId: recv.id,
      saleId: recv.saleId,
      amountCents: input.amountCents,
      netAmountCents,
      feePercent: input.feePercentBasisPoints ?? 0,
      feeCents,
      method: input.method,
      cashRegisterId: input.cashRegisterId,
      createdByUserId: userId,
    },
  });

  await db.cashRegisterEntry.create({
    data: {
      organizationId,
      cashRegisterId: input.cashRegisterId,
      entryType: "PAGAMENTO",
      amountCents: input.amountCents,
      paymentId: payment.id,
      createdByUserId: userId,
    },
  });

  await updateReceivableStatus(db, recv.id);
  return payment;
}

export function applyDiscountToItems(
  items: SaleItemInput[],
  discountCents: number,
): { netLineCents: number[]; subtotalCents: number; totalCents: number } {
  const lineTotals = items.map((i) => (i.quantity ?? 1) * i.unitPriceCents);
  const subtotalCents = sumCents(lineTotals);
  const allocations = allocateDiscount(lineTotals, discountCents);
  const netLineCents = lineTotals.map((t, i) => t - allocations[i]);
  return {
    netLineCents,
    subtotalCents,
    totalCents: subtotalCents - discountCents,
  };
}

export async function getSaleByAppointment(db: TenantClient, appointmentId: string) {
  const appt = await db.appointment.findFirst({
    where: { id: appointmentId },
    include: {
      sale: { include: { items: true, receivables: true, payments: true } },
    },
  });
  return appt?.sale ?? null;
}
