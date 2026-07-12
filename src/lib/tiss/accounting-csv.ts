import type { TissProcedureLine } from "./types";

export type AccountingRow = {
  lote: string | number;
  competencia: string;
  guia: string | number;
  tipoGuia: string;
  beneficiario: string;
  carteirinha: string;
  profissional: string;
  conselho: string;
  codigoTuss: string;
  descricao: string;
  quantidade: number;
  valorUnitario: string;
  valorTotal: string;
};

export function buildAccountingCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => String(r[h] ?? "")).join(";")),
  ];
  return lines.join("\n");
}

export function buildBatchAccountingRows(input: {
  batchNumber: number;
  competence: string;
  guides: Array<{
    guideNumber: number;
    guideType: string;
    beneficiaryName: string;
    beneficiaryCard: string;
    professionalName: string;
    professionalCouncilNumber?: string | null;
    procedures: TissProcedureLine[];
    totalValueCents: number;
  }>;
}): AccountingRow[] {
  const rows: AccountingRow[] = [];

  for (const guide of input.guides) {
    const procedures =
      guide.procedures.length > 0
        ? guide.procedures
        : [
            {
              tussCode: "",
              term: "",
              quantity: 1,
              unitValueCents: guide.totalValueCents,
              totalValueCents: guide.totalValueCents,
              executionDate: "",
            },
          ];

    for (const proc of procedures) {
      rows.push({
        lote: input.batchNumber,
        competencia: input.competence,
        guia: guide.guideNumber,
        tipoGuia: guide.guideType,
        beneficiario: guide.beneficiaryName,
        carteirinha: guide.beneficiaryCard,
        profissional: guide.professionalName,
        conselho: guide.professionalCouncilNumber ?? "",
        codigoTuss: proc.tussCode,
        descricao: proc.term,
        quantidade: proc.quantity,
        valorUnitario: (proc.unitValueCents / 100).toFixed(2),
        valorTotal: (proc.totalValueCents / 100).toFixed(2),
      });
    }
  }

  return rows;
}
