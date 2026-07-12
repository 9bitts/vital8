"use server";

import { revalidatePath } from "next/cache";
import {
  AuthError,
  getRequestMeta,
  requireAuth,
  type ActionResult,
} from "@/lib/auth/guards";
import { createAuditLog } from "@/modules/core/services/audit.service";
import { formatBRL } from "@/lib/money";
import { getNfseAdapter } from "@/lib/integrations/nfse";
import { getPaymentsAdapter } from "@/lib/integrations/payments";
import {
  canAccessFinance,
  canAuthorizeDiscount,
  canManageCommissionRules,
  canManageFinance,
  canRefund,
  getDiscountLimitCents,
} from "@/modules/finance/lib/permissions";
import {
  cashMovementSchema,
  checkoutSchema,
  closeCashRegisterSchema,
  commissionAccrueSchema,
  commissionRuleSchema,
  openCashRegisterSchema,
  packagePurchaseSchema,
  payableSchema,
  paymentSchema,
  receivableFilterSchema,
  refundSchema,
} from "@/modules/finance/schemas/finance.schema";
import {
  closeCashRegister,
  getOpenCashRegister,
  listCashRegisterHistory,
  openCashRegister,
  cashMovement,
} from "@/modules/finance/services/cash-register.service";
import {
  accrueCommissionStatement,
  closeCommissionStatement,
} from "@/modules/finance/services/commission.service";
import { sendOverdueReminders } from "@/modules/finance/services/collection.service";
import { purchasePackage, listPatientPackageBalances } from "@/modules/finance/services/package.service";
import { resolveServicePriceCents } from "@/modules/finance/services/price-table.service";
import { processRefund } from "@/modules/finance/services/refund.service";
import {
  getBillingReport,
  getCashFlow,
  getDre,
  getFinanceDashboard,
} from "@/modules/finance/services/report.service";
import {
  checkoutSale,
  registerPayment,
} from "@/modules/finance/services/sale.service";
import { adminPrisma } from "@/lib/db/admin-client";

const FINANCE_ROLES = ["OWNER", "ADMIN", "RECEPCAO", "FINANCEIRO"] as const;

async function auditFinance(
  action: string,
  ctx: { userId: string; organizationId: string },
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  const meta = await getRequestMeta();
  await createAuditLog({
    action,
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    entityType,
    entityId,
    metadata: metadata as import("@/generated/prisma/client").Prisma.InputJsonValue,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export async function getFinanceDashboardAction() {
  const ctx = await requireAuth([...FINANCE_ROLES]);
  if (!canAccessFinance(ctx.role)) throw new AuthError("Acesso negado", "FORBIDDEN");
  return getFinanceDashboard(ctx.db);
}

export async function prepareCheckoutAction(appointmentId: string) {
  const ctx = await requireAuth([...FINANCE_ROLES]);
  const appt = await ctx.db.appointment.findFirstOrThrow({
    where: { id: appointmentId },
    include: {
      patient: { include: { insurancePlans: { take: 1 } } },
      patientInsurancePlan: { include: { healthInsurer: true } },
      service: true,
      professional: true,
      sale: { include: { items: true } },
    },
  });

  const insurer = appt.patient.insurancePlans[0]?.insurerName ?? null;
  const priceCents = await resolveServicePriceCents(
    ctx.db,
    appt.serviceId,
    appt.isPrivate,
    insurer,
  );

  const openRegister = await getOpenCashRegister(ctx.db, ctx.userId);
  const isInsurance = !appt.isPrivate;
  const copPct = appt.patientInsurancePlan?.healthInsurer?.coparticipationPercent ?? 0;
  const coparticipationCents = isInsurance
    ? Math.round((priceCents * copPct) / 100)
    : 0;

  return {
    appointment: appt,
    isInsurance,
    coparticipationCents,
    billableCents: isInsurance ? coparticipationCents : priceCents,
    suggestedItem: {
      serviceId: appt.serviceId,
      description: appt.service.name,
      unitPriceCents: isInsurance ? coparticipationCents : priceCents,
      quantity: 1,
    },
    existingSale: appt.sale,
    openRegister,
  };
}

export async function checkoutAction(
  input: unknown,
): Promise<ActionResult<{ saleId: string; paymentId: string; receiptText: string; nfseNumber?: string }>> {
  try {
    const ctx = await requireAuth([...FINANCE_ROLES]);
    const parsed = checkoutSchema.parse(input);

    if (parsed.discountCents > 0) {
      const limit = getDiscountLimitCents(ctx.role);
      if (parsed.discountCents > limit && !canAuthorizeDiscount(ctx.role)) {
        return { success: false, error: "Desconto acima do limite permitido" };
      }
      if (!parsed.discountReason) {
        return { success: false, error: "Motivo do desconto obrigatório" };
      }
    }

    const result = await checkoutSale(ctx.db, ctx.organizationId, ctx.userId, {
      ...parsed,
      discountAuthorizedByUserId:
        parsed.discountCents > 0 ? ctx.userId : null,
    });

    let nfseNumber: string | undefined;
    if (parsed.emitNfse) {
      const patient = await ctx.db.patient.findFirstOrThrow({
        where: { id: parsed.patientId },
      });
      const nfse = await getNfseAdapter().issue({
        organizationId: ctx.organizationId,
        patientName: patient.socialName ?? patient.fullName,
        serviceDescription: parsed.items.map((i) => i.description).join(", "),
        amountCents: result.sale.totalCents,
      });
      nfseNumber = nfse.number;
      await ctx.db.sale.update({
        where: { id: result.sale.id },
        data: { nfseNumber },
      });
    }

    const receiptText = [
      "RECIBO Vital8",
      `Venda: ${result.sale.id}`,
      `Total: ${formatBRL(result.sale.totalCents)}`,
      `Pago: ${formatBRL(result.payment.amountCents)}`,
      nfseNumber ? `NFS-e: ${nfseNumber}` : "",
    ].filter(Boolean).join("\n");

    await auditFinance("sale.checkout", ctx, "Sale", result.sale.id, {
      totalCents: result.sale.totalCents,
      method: parsed.paymentMethod,
    });

    revalidatePath("/app/recepcao");
    revalidatePath("/app/financeiro");
    return {
      success: true,
      data: {
        saleId: result.sale.id,
        paymentId: result.payment.id,
        receiptText,
        nfseNumber,
      },
    };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro no checkout" };
  }
}

export async function openCashRegisterAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth([...FINANCE_ROLES]);
    const parsed = openCashRegisterSchema.parse(input);
    const reg = await openCashRegister(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      parsed.openingAmountCents,
    );
    await auditFinance("cash.open", ctx, "CashRegister", reg.id, parsed);
    revalidatePath("/app/financeiro/caixa");
    return { success: true, data: { id: reg.id } };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao abrir caixa" };
  }
}

export async function closeCashRegisterAction(
  input: unknown,
): Promise<ActionResult<{ differenceCents: number }>> {
  try {
    const ctx = await requireAuth([...FINANCE_ROLES]);
    const parsed = closeCashRegisterSchema.parse(input);
    const closed = await closeCashRegister(ctx.db, ctx.userId, parsed);
    await auditFinance("cash.close", ctx, "CashRegister", parsed.cashRegisterId, {
      countedCents: parsed.countedCents,
      differenceCents: closed.closingDifferenceCents,
    });
    revalidatePath("/app/financeiro/caixa");
    return {
      success: true,
      data: { differenceCents: closed.closingDifferenceCents ?? 0 },
    };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao fechar caixa" };
  }
}

export async function cashMovementAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...FINANCE_ROLES]);
    const parsed = cashMovementSchema.parse(input);
    await cashMovement(ctx.db, ctx.organizationId, ctx.userId, parsed);
    await auditFinance("cash.movement", ctx, "CashRegister", parsed.cashRegisterId, parsed);
    revalidatePath("/app/financeiro/caixa");
    return { success: true };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro na movimentação" };
  }
}

export async function getCashRegisterStateAction() {
  const ctx = await requireAuth([...FINANCE_ROLES]);
  const open = await getOpenCashRegister(ctx.db, ctx.userId);
  const history = await listCashRegisterHistory(ctx.db, ctx.userId);
  return { open, history };
}

export async function listReceivablesAction(input: unknown) {
  const ctx = await requireAuth([...FINANCE_ROLES]);
  const parsed = receivableFilterSchema.parse(input ?? {});
  return ctx.db.receivable.findMany({
    where: {
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.patientId ? { patientId: parsed.patientId } : {}),
      ...(parsed.from || parsed.to
        ? {
            dueDate: {
              ...(parsed.from ? { gte: parsed.from } : {}),
              ...(parsed.to ? { lte: parsed.to } : {}),
            },
          }
        : {}),
    },
    include: { patient: { select: { fullName: true, socialName: true } } },
    orderBy: { dueDate: "asc" },
    take: 100,
  });
}

export async function registerPaymentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth([...FINANCE_ROLES]);
    const parsed = paymentSchema.parse(input);
    const payment = await registerPayment(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      parsed,
    );
    await auditFinance("payment.register", ctx, "Payment", payment.id, parsed);
    revalidatePath("/app/financeiro/receber");
    return { success: true, data: { id: payment.id } };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao registrar pagamento" };
  }
}

export async function createPayableAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth([...FINANCE_ROLES]);
    if (!canManageFinance(ctx.role)) {
      return { success: false, error: "Permissão insuficiente" };
    }
    const parsed = payableSchema.parse(input);
    const payable = await ctx.db.payable.create({
      data: {
        organizationId: ctx.organizationId,
        ...parsed,
      },
    });
    await auditFinance("payable.create", ctx, "Payable", payable.id, parsed);
    revalidatePath("/app/financeiro/pagar");
    return { success: true, data: { id: payable.id } };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao criar conta a pagar" };
  }
}

export async function payPayableAction(payableId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...FINANCE_ROLES]);
    await ctx.db.payable.update({
      where: { id: payableId },
      data: { status: "PAGO", paidAt: new Date() },
    });
    await auditFinance("payable.pay", ctx, "Payable", payableId, {});
    revalidatePath("/app/financeiro/pagar");
    return { success: true };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao baixar conta" };
  }
}

export async function listPayablesAction() {
  const ctx = await requireAuth([...FINANCE_ROLES]);
  return ctx.db.payable.findMany({
    include: { supplier: true, category: true },
    orderBy: { dueDate: "asc" },
    take: 100,
  });
}

export async function getCashFlowAction(from: string, to: string) {
  const ctx = await requireAuth([...FINANCE_ROLES]);
  return getCashFlow(ctx.db, new Date(from), new Date(to));
}

export async function getDreAction(year: number, month: number) {
  const ctx = await requireAuth([...FINANCE_ROLES]);
  return getDre(ctx.db, year, month);
}

export async function saveCommissionRuleAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    if (!canManageCommissionRules(ctx.role)) {
      return { success: false, error: "Permissão insuficiente" };
    }
    const parsed = commissionRuleSchema.parse(input);
    const rule = await ctx.db.commissionRule.create({
      data: { organizationId: ctx.organizationId, ...parsed },
    });
    revalidatePath("/app/financeiro/repasse");
    return { success: true, data: { id: rule.id } };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao salvar regra" };
  }
}

export async function accrueCommissionAction(input: unknown) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO", "PROFISSIONAL_SAUDE"]);
  const parsed = commissionAccrueSchema.parse(input);
  if (ctx.role === "PROFISSIONAL_SAUDE") {
    const prof = await ctx.db.professional.findFirst({
      where: { displayName: { contains: ctx.userName.split(" ")[0] } },
    });
    if (prof && prof.id !== parsed.professionalId) {
      throw new AuthError("Acesso negado", "FORBIDDEN");
    }
  }
  return accrueCommissionStatement(
    ctx.db,
    ctx.organizationId,
    parsed.professionalId,
    parsed.periodStart,
    parsed.periodEnd,
  );
}

export async function closeCommissionAction(statementId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    await closeCommissionStatement(ctx.db, statementId);
    await auditFinance("commission.close", ctx, "CommissionStatement", statementId, {});
    revalidatePath("/app/financeiro/repasse");
    return { success: true };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao fechar repasse" };
  }
}

export async function listCommissionRulesAction() {
  const ctx = await requireAuth([...FINANCE_ROLES, "PROFISSIONAL_SAUDE"]);
  return ctx.db.commissionRule.findMany({
    include: { professional: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function purchasePackageAction(
  input: unknown,
): Promise<ActionResult<{ purchaseId: string }>> {
  try {
    const ctx = await requireAuth([...FINANCE_ROLES]);
    const parsed = packagePurchaseSchema.parse(input);
    const result = await purchasePackage(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      parsed,
    );
    await auditFinance("package.purchase", ctx, "PackagePurchase", result.purchase.id, parsed);
    revalidatePath("/app/financeiro/pacotes");
    return { success: true, data: { purchaseId: result.purchase.id } };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao vender pacote" };
  }
}

export async function listPackagesAction() {
  const ctx = await requireAuth([...FINANCE_ROLES]);
  return ctx.db.package.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getPatientPackagesAction(patientId: string) {
  const ctx = await requireAuth([...FINANCE_ROLES, "PROFISSIONAL_SAUDE", "RECEPCAO"]);
  return listPatientPackageBalances(ctx.db, patientId);
}

export async function refundPaymentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    if (!canRefund(ctx.role)) {
      return { success: false, error: "Permissão insuficiente" };
    }
    const parsed = refundSchema.parse(input);
    const refund = await processRefund(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      ctx.userId,
      parsed,
    );
    await auditFinance("payment.refund", ctx, "Refund", refund.id, parsed);
    revalidatePath("/app/financeiro");
    return { success: true, data: { id: refund.id } };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro no estorno" };
  }
}

export async function runCollectionRemindersAction(): Promise<ActionResult<{ sent: number }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
    const org = await adminPrisma.organization.findFirstOrThrow({
      where: { id: ctx.organizationId },
    });
    const result = await sendOverdueReminders(
      ctx.db,
      ctx.organizationId,
      org.name,
    );
    return { success: true, data: result };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro na régua de cobrança" };
  }
}

export async function getBillingReportAction(from: string, to: string) {
  const ctx = await requireAuth([...FINANCE_ROLES]);
  return getBillingReport(ctx.db, new Date(from), new Date(to));
}

export async function createPaymentLinkAction(
  amountCents: number,
  description: string,
  patientName: string,
) {
  const ctx = await requireAuth([...FINANCE_ROLES]);
  return getPaymentsAdapter().createLink({
    organizationId: ctx.organizationId,
    amountCents,
    description,
    patientName,
  });
}

export async function getPatientFinanceHistoryAction(patientId: string) {
  const ctx = await requireAuth([...FINANCE_ROLES, "RECEPCAO", "PROFISSIONAL_SAUDE"]);
  const [sales, payments] = await Promise.all([
    ctx.db.sale.findMany({
      where: { patientId, status: "CONFIRMADA" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { items: true },
    }),
    ctx.db.payment.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return { sales, payments };
}

export async function listSuppliersAction() {
  const ctx = await requireAuth([...FINANCE_ROLES]);
  return ctx.db.supplier.findMany({ where: { isActive: true } });
}

export async function listFinancialCategoriesAction() {
  const ctx = await requireAuth([...FINANCE_ROLES]);
  return ctx.db.financialCategory.findMany({
    include: { children: true, parent: true },
    orderBy: { name: "asc" },
  });
}
