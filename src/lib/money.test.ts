import { describe, it, expect } from "vitest";
import {
  allocateDiscount,
  splitInstallments,
  calculateNetAmount,
  proportionalPackageRefund,
  formatBRL,
  sumCents,
} from "@/lib/money";

describe("money helpers", () => {
  it("formata BRL a partir de centavos", () => {
    expect(formatBRL(19990)).toContain("199");
  });

  it("rateia desconto entre itens com soma exata", () => {
    const items = [10000, 5000, 5000];
    const discount = 2000;
    const shares = allocateDiscount(items, discount);
    expect(sumCents(shares)).toBe(discount);
    expect(shares[0]).toBe(1000);
    expect(shares[1]).toBe(500);
    expect(shares[2]).toBe(500);
  });

  it("rateio absorve arredondamento no último item", () => {
    const items = [3333, 3333, 3334];
    const discount = 1000;
    const shares = allocateDiscount(items, discount);
    expect(sumCents(shares)).toBe(discount);
  });

  it("parcelas somam o total exato", () => {
    const total = 10000;
    const parts = splitInstallments(total, 3);
    expect(sumCents(parts)).toBe(total);
    expect(parts).toEqual([3334, 3333, 3333]);
  });

  it("parcela única retorna total", () => {
    expect(splitInstallments(15000, 1)).toEqual([15000]);
  });

  it("calcula taxa e líquido", () => {
    const { feeCents, netAmountCents } = calculateNetAmount(10000, 350);
    expect(feeCents).toBe(350);
    expect(netAmountCents).toBe(9650);
  });

  it("refund proporcional de pacote", () => {
    expect(proportionalPackageRefund(100000, 10, 3)).toBe(70000);
    expect(proportionalPackageRefund(100000, 10, 10)).toBe(0);
  });
});
