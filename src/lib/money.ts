/** Valores monetários sempre em centavos inteiros. */

export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

export function centsToReais(cents: number): number {
  return cents / 100;
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centsToReais(cents));
}

export function sumCents(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** Rateia desconto proporcionalmente entre itens; último item absorve arredondamento. */
export function allocateDiscount(
  itemTotalsCents: number[],
  discountCents: number,
): number[] {
  if (discountCents <= 0) return itemTotalsCents.map(() => 0);
  const subtotal = sumCents(itemTotalsCents);
  if (subtotal <= 0) return itemTotalsCents.map(() => 0);

  const allocations: number[] = [];
  let allocated = 0;

  for (let i = 0; i < itemTotalsCents.length; i++) {
    if (i === itemTotalsCents.length - 1) {
      allocations.push(discountCents - allocated);
    } else {
      const share = Math.floor((itemTotalsCents[i] * discountCents) / subtotal);
      allocations.push(share);
      allocated += share;
    }
  }

  return allocations;
}

/** Divide total em N parcelas; soma exata = totalCents. */
export function splitInstallments(
  totalCents: number,
  count: number,
): number[] {
  if (count < 1) throw new Error("Parcelas deve ser >= 1");
  if (totalCents < 0) throw new Error("Total inválido");

  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  const installments: number[] = [];

  for (let i = 0; i < count; i++) {
    installments.push(base + (i < remainder ? 1 : 0));
  }

  return installments;
}

/** Calcula taxa da adquirente e valor líquido. feePercent em basis points (350 = 3.5%). */
export function calculateNetAmount(
  amountCents: number,
  feePercentBasisPoints: number,
): { feeCents: number; netAmountCents: number } {
  const feeCents = Math.round((amountCents * feePercentBasisPoints) / 10000);
  return {
    feeCents,
    netAmountCents: amountCents - feeCents,
  };
}

/** Valor proporcional de cancelamento de pacote. */
export function proportionalPackageRefund(
  priceCents: number,
  sessionsTotal: number,
  sessionsUsed: number,
): number {
  if (sessionsTotal <= 0) return 0;
  const remaining = Math.max(0, sessionsTotal - sessionsUsed);
  return Math.round((priceCents * remaining) / sessionsTotal);
}

export function decimalToCents(value: { toNumber(): number } | number): number {
  const n = typeof value === "number" ? value : value.toNumber();
  return reaisToCents(n);
}
