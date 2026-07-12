import { describe, it, expect } from "vitest";
import {
  calculateCommissionForLine,
  computeCommissionLines,
  applyDiscountToCommissionBase,
} from "@/modules/finance/services/commission.service";

describe("commission calculation", () => {
  it("calcula percentual sobre base faturada", () => {
    expect(calculateCommissionForLine(10000, "PERCENTUAL", 3000)).toBe(3000);
  });

  it("calcula valor fixo", () => {
    expect(calculateCommissionForLine(10000, "FIXO", 5000)).toBe(5000);
  });

  it("apura comissão base FATURADO", () => {
    const lines = computeCommissionLines(
      [
        {
          id: "s1",
          totalCents: 9000,
          discountCents: 1000,
          subtotalCents: 10000,
          professionalId: "p1",
          isPrivate: true,
          serviceId: "svc1",
          payments: [{ id: "pay1", amountCents: 9000, netAmountCents: 9000 }],
        },
      ],
      [
        {
          professionalId: "p1",
          serviceId: null,
          ruleType: "PERCENTUAL",
          value: 1000,
          base: "FATURADO",
          isPrivate: null,
        },
      ],
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].commissionCents).toBe(900);
  });

  it("apura comissão base RECEBIDO com pagamento parcial", () => {
    const lines = computeCommissionLines(
      [
        {
          id: "s1",
          totalCents: 10000,
          discountCents: 0,
          subtotalCents: 10000,
          professionalId: "p1",
          isPrivate: true,
          serviceId: null,
          payments: [{ id: "pay1", amountCents: 5000, netAmountCents: 4800 }],
        },
      ],
      [
        {
          professionalId: "p1",
          serviceId: null,
          ruleType: "PERCENTUAL",
          value: 1000,
          base: "RECEBIDO",
          isPrivate: null,
        },
      ],
    );
    expect(lines[0].baseCents).toBe(4800);
    expect(lines[0].commissionCents).toBe(480);
  });

  it("desconto reduz base proporcionalmente", () => {
    const net = applyDiscountToCommissionBase(5000, 1000, 10000);
    expect(net).toBe(4000);
  });
});
