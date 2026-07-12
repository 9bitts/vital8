import type { PrismaClient } from "../src/generated/prisma/client";

const INTERACTIONS: Array<{
  a: string;
  b: string;
  severity: "WARNING" | "BLOCKING";
  description: string;
}> = [
  {
    a: "ibuprofeno",
    b: "losartana",
    severity: "WARNING",
    description: "IBP pode reduzir efeito anti-hipertensivo — monitorar PA",
  },
  {
    a: "tramadol",
    b: "fluoxetina",
    severity: "BLOCKING",
    description: "Risco de síndrome serotoninérgica — contraindicado",
  },
  {
    a: "amoxicilina",
    b: "metotrexato",
    severity: "WARNING",
    description: "Antibiótico pode aumentar toxicidade do metotrexato",
  },
  {
    a: "captopril",
    b: "espironolactona",
    severity: "WARNING",
    description: "Risco de hipercalemia — monitorar potássio",
  },
];

export async function seedDrugInteractions(prisma: PrismaClient) {
  for (const row of INTERACTIONS) {
    const existing = await prisma.drugInteraction.findFirst({
      where: {
        activeIngredientA: row.a,
        activeIngredientB: row.b,
      },
    });
    if (existing) continue;
    await prisma.drugInteraction.create({
      data: {
        activeIngredientA: row.a,
        activeIngredientB: row.b,
        severity: row.severity,
        description: row.description,
      },
    });
  }
}
