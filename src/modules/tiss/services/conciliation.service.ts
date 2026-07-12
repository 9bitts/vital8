import type { TenantClient } from "@/lib/db/tenant-client";
import { sumCents } from "@/lib/money";
import { glosaAppealSchema, insurerPaymentSchema } from "../schemas/tiss.schema";

export async function registerInsurerPayment(
  db: TenantClient,
  organizationId: string,
  userId: string,
  input: unknown,
) {
  const data = insurerPaymentSchema.parse(input);

  const batch = await db.tissBatch.findFirstOrThrow({
    where: { id: data.tissBatchId },
    include: { guides: true, receivable: true },
  });

  if (batch.status !== "ENVIADO" && batch.status !== "FECHADO") {
    throw new Error("Lote deve estar fechado ou enviado para conciliação");
  }

  const payment = await db.insurerPayment.create({
    data: {
      organizationId,
      healthInsurerId: data.healthInsurerId,
      tissBatchId: data.tissBatchId,
      paymentDate: data.paymentDate,
      grossAmountCents: data.grossAmountCents,
      discountCents: data.discountCents,
      netAmountCents: data.netAmountCents,
      notes: data.notes ?? null,
      guidePayments: data.guidePayments,
    },
  });

  for (const gp of data.guidePayments) {
    const guide = batch.guides.find((g) => g.id === gp.guideId);
    if (!guide) continue;

    let status: "PAGA" | "GLOSADA_PARCIAL" | "GLOSADA_TOTAL" = "PAGA";
    if (gp.glosedCents > 0 && gp.paidCents > 0) status = "GLOSADA_PARCIAL";
    if (gp.glosedCents >= guide.totalValueCents) status = "GLOSADA_TOTAL";
    if (gp.paidCents === 0 && gp.glosedCents > 0) status = "GLOSADA_TOTAL";

    await db.tissGuide.update({
      where: { id: gp.guideId },
      data: { status },
    });

    if (gp.glosedCents > 0 && gp.glosaReasonCode) {
      const proc = (guide.procedures as Array<{ tussCode: string }>)[0];
      await db.glosaItem.create({
        data: {
          organizationId,
          tissGuideId: gp.guideId,
          insurerPaymentId: payment.id,
          tussProcedureCode: proc?.tussCode ?? "00000000",
          glosaReasonCode: gp.glosaReasonCode,
          glosedAmountCents: gp.glosedCents,
          status: "ACEITA",
        },
      });
    }
  }

  if (batch.receivable) {
    const paidTotal = sumCents(data.guidePayments.map((g) => g.paidCents));
    await db.receivable.update({
      where: { id: batch.receivable.id },
      data: {
        paidCents: paidTotal,
        status: paidTotal >= batch.receivable.totalCents ? "PAGO" : "PARCIAL",
      },
    });

    await db.payment.create({
      data: {
        organizationId,
        patientId: batch.receivable.patientId,
        receivableId: batch.receivable.id,
        amountCents: data.netAmountCents,
        netAmountCents: data.netAmountCents,
        method: "TRANSFERENCIA",
        createdByUserId: userId,
        notes: `Demonstrativo operadora — lote #${batch.batchNumber}`,
      },
    });
  }

  await db.tissBatch.update({
    where: { id: batch.id },
    data: { status: "CONCILIADO" },
  });

  return payment;
}

export async function listGlosaItems(
  db: TenantClient,
  status?: string,
) {
  return db.glosaItem.findMany({
    where: status ? { status: status as never } : {},
    include: {
      tissGuide: { include: { healthInsurer: true, appointment: { include: { patient: true } } } },
      reasonCode: true,
      insurerPayment: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function startGlosaAppeal(
  db: TenantClient,
  input: unknown,
) {
  const data = glosaAppealSchema.parse(input);
  return db.glosaItem.update({
    where: { id: data.glosaItemId },
    data: {
      status: "EM_RECURSO",
      appealJustification: data.justification,
      appealDeadline: data.appealDeadline,
    },
  });
}

export async function resolveGlosaAppeal(
  db: TenantClient,
  glosaItemId: string,
  outcome: "RECUPERADA" | "PERDIDA",
) {
  return db.glosaItem.update({
    where: { id: glosaItemId },
    data: { status: outcome },
  });
}

export async function getConciliationView(db: TenantClient, batchId: string) {
  const batch = await db.tissBatch.findFirstOrThrow({
    where: { id: batchId },
    include: {
      healthInsurer: true,
      guides: true,
      insurerPayments: true,
      receivable: true,
    },
  });

  const payment = batch.insurerPayments[0] ?? null;
  const guidePayments = (payment?.guidePayments ?? []) as Array<{
    guideId: string;
    paidCents: number;
    glosedCents: number;
  }>;

  const rows = batch.guides.map((g) => {
    const gp = guidePayments.find((p) => p.guideId === g.id);
    return {
      guide: g,
      expectedCents: g.totalValueCents,
      paidCents: gp?.paidCents ?? 0,
      glosedCents: gp?.glosedCents ?? 0,
      divergent: gp
        ? gp.paidCents + gp.glosedCents !== g.totalValueCents
        : true,
    };
  });

  return { batch, payment, rows };
}
