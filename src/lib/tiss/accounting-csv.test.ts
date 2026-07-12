import { describe, expect, it } from "vitest";
import { buildAccountingCsv, buildBatchAccountingRows } from "./accounting-csv";

describe("accounting-csv", () => {
  it("builds semicolon-separated CSV", () => {
    const csv = buildAccountingCsv([
      { lote: 1, guia: 10, valor: "150.00" },
      { lote: 1, guia: 11, valor: "200.00" },
    ]);
    expect(csv.split("\n")[0]).toBe("lote;guia;valor");
    expect(csv).toContain("1;10;150.00");
  });

  it("expands batch guides to accounting rows", () => {
    const rows = buildBatchAccountingRows({
      batchNumber: 5,
      competence: "2026-07",
      guides: [
        {
          guideNumber: 100,
          guideType: "GUIA_CONSULTA",
          beneficiaryName: "Ana",
          beneficiaryCard: "999",
          professionalName: "Dr. B",
          professionalCouncilNumber: "CRM 1",
          procedures: [
            {
              tussCode: "10101012",
              term: "Consulta",
              quantity: 1,
              unitValueCents: 15000,
              totalValueCents: 15000,
              executionDate: "2026-07-01",
            },
          ],
          totalValueCents: 15000,
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].codigoTuss).toBe("10101012");
    expect(rows[0].valorTotal).toBe("150.00");
    expect(buildAccountingCsv(rows)).toContain("10101012");
  });
});
