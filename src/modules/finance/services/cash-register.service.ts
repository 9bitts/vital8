import type { TenantClient } from "@/lib/db/tenant-client";
import { sumCents } from "@/lib/money";

export async function openCashRegister(
  db: TenantClient,
  organizationId: string,
  userId: string,
  openingAmountCents: number,
) {
  const open = await db.cashRegister.findFirst({
    where: { userId, status: "ABERTO" },
  });
  if (open) throw new Error("Caixa já aberto para este usuário");

  const register = await db.cashRegister.create({
    data: {
      organizationId,
      userId,
      status: "ABERTO",
      openingAmountCents,
    },
  });

  await db.cashRegisterEntry.create({
    data: {
      organizationId,
      cashRegisterId: register.id,
      entryType: "ABERTURA",
      amountCents: openingAmountCents,
      createdByUserId: userId,
    },
  });

  return register;
}

export async function getOpenCashRegister(db: TenantClient, userId: string) {
  return db.cashRegister.findFirst({
    where: { userId, status: "ABERTO" },
    include: {
      entries: { orderBy: { createdAt: "asc" } },
      payments: true,
    },
  });
}

export async function calculateExpectedBalance(
  db: TenantClient,
  cashRegisterId: string,
): Promise<number> {
  const register = await db.cashRegister.findFirstOrThrow({
    where: { id: cashRegisterId },
    include: { entries: true },
  });

  let balance = register.openingAmountCents;
  for (const e of register.entries) {
    if (e.entryType === "PAGAMENTO" || e.entryType === "REFORCO" || e.entryType === "ABERTURA") {
      balance += e.amountCents;
    } else if (e.entryType === "SANGRIA" || e.entryType === "ESTORNO") {
      balance -= e.amountCents;
    }
  }
  return balance;
}

export async function cashMovement(
  db: TenantClient,
  organizationId: string,
  userId: string,
  input: {
    cashRegisterId: string;
    entryType: "SANGRIA" | "REFORCO";
    amountCents: number;
    reason: string;
  },
) {
  const register = await db.cashRegister.findFirstOrThrow({
    where: { id: input.cashRegisterId, status: "ABERTO" },
  });

  return db.cashRegisterEntry.create({
    data: {
      organizationId,
      cashRegisterId: register.id,
      entryType: input.entryType,
      amountCents: input.amountCents,
      reason: input.reason,
      createdByUserId: userId,
    },
  });
}

export async function closeCashRegister(
  db: TenantClient,
  userId: string,
  input: { cashRegisterId: string; countedCents: number },
) {
  const register = await db.cashRegister.findFirstOrThrow({
    where: { id: input.cashRegisterId, status: "ABERTO" },
  });

  const expected = await calculateExpectedBalance(db, register.id);
  const difference = input.countedCents - expected;

  return db.cashRegister.update({
    where: { id: register.id },
    data: {
      status: "FECHADO",
      closingExpectedCents: expected,
      closingCountedCents: input.countedCents,
      closingDifferenceCents: difference,
      closedAt: new Date(),
    },
  });
}

export async function listCashRegisterHistory(
  db: TenantClient,
  userId?: string,
) {
  return db.cashRegister.findMany({
    where: userId ? { userId } : {},
    orderBy: { openedAt: "desc" },
    take: 30,
    include: { entries: true },
  });
}

export async function getCashRegisterSummary(db: TenantClient, registerId: string) {
  const register = await db.cashRegister.findFirstOrThrow({
    where: { id: registerId },
    include: { entries: { orderBy: { createdAt: "asc" } } },
  });
  const expected = await calculateExpectedBalance(db, registerId);
  const paymentsTotal = sumCents(
    register.entries
      .filter((e) => e.entryType === "PAGAMENTO")
      .map((e) => e.amountCents),
  );
  return { register, expected, paymentsTotal };
}
