import { z } from "zod";

export const checkoutSchema = z.object({
  appointmentId: z.string().optional().nullable(),
  patientId: z.string(),
  professionalId: z.string().optional().nullable(),
  items: z.array(
    z.object({
      itemType: z.enum(["SERVICE", "PACKAGE", "PRODUCT"]).optional(),
      serviceId: z.string().optional().nullable(),
      packageId: z.string().optional().nullable(),
      description: z.string().min(1),
      quantity: z.coerce.number().int().min(1).default(1),
      unitPriceCents: z.coerce.number().int().min(0),
    }),
  ).min(1),
  discountCents: z.coerce.number().int().min(0).default(0),
  discountReason: z.string().optional().nullable(),
  paymentMethod: z.enum([
    "DINHEIRO",
    "PIX",
    "DEBITO",
    "CREDITO",
    "TRANSFERENCIA",
    "LINK",
  ]),
  installmentCount: z.coerce.number().int().min(1).max(24).default(1),
  creditCardInstallments: z.coerce.number().int().min(1).default(1),
  feePercentBasisPoints: z.coerce.number().int().min(0).default(0),
  cashRegisterId: z.string(),
  emitNfse: z.boolean().default(false),
});

export const openCashRegisterSchema = z.object({
  openingAmountCents: z.coerce.number().int().min(0),
  branchId: z.string().cuid().optional().nullable(),
});

export const closeCashRegisterSchema = z.object({
  cashRegisterId: z.string(),
  countedCents: z.coerce.number().int().min(0),
});

export const cashMovementSchema = z.object({
  cashRegisterId: z.string(),
  entryType: z.enum(["SANGRIA", "REFORCO"]),
  amountCents: z.coerce.number().int().positive(),
  reason: z.string().min(1),
});

export const paymentSchema = z.object({
  receivableId: z.string(),
  amountCents: z.coerce.number().int().positive(),
  method: z.enum([
    "DINHEIRO",
    "PIX",
    "DEBITO",
    "CREDITO",
    "TRANSFERENCIA",
    "LINK",
  ]),
  cashRegisterId: z.string(),
  feePercentBasisPoints: z.coerce.number().int().min(0).default(0),
});

export const refundSchema = z.object({
  paymentId: z.string(),
  amountCents: z.coerce.number().int().positive(),
  reason: z.string().min(3),
  cashRegisterId: z.string().optional().nullable(),
});

export const payableSchema = z.object({
  description: z.string().min(2),
  amountCents: z.coerce.number().int().positive(),
  supplierId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  competenceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  isRecurring: z.boolean().default(false),
  recurringDay: z.coerce.number().int().min(1).max(28).optional().nullable(),
});

export const commissionRuleSchema = z.object({
  professionalId: z.string(),
  serviceId: z.string().optional().nullable(),
  ruleType: z.enum(["PERCENTUAL", "FIXO"]),
  value: z.coerce.number().int().positive(),
  base: z.enum(["FATURADO", "RECEBIDO"]).default("FATURADO"),
  isPrivate: z.boolean().optional().nullable(),
});

export const commissionAccrueSchema = z.object({
  professionalId: z.string(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});

export const packagePurchaseSchema = z.object({
  patientId: z.string(),
  packageId: z.string(),
  cashRegisterId: z.string(),
  paymentMethod: z.enum([
    "DINHEIRO",
    "PIX",
    "DEBITO",
    "CREDITO",
    "TRANSFERENCIA",
    "LINK",
  ]),
});

export const receivableFilterSchema = z.object({
  status: z.enum(["ABERTO", "PARCIAL", "PAGO", "VENCIDO", "CANCELADO"]).optional(),
  patientId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
