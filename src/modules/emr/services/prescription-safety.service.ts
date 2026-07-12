import { adminPrisma } from "@/lib/db/admin-client";
import type { TenantClient } from "@/lib/db/tenant-client";
import type { PrescriptionItemInput } from "./prescription.service";
import { getOrCreatePrescriptionSettings } from "./prescription-settings.service";

export type SafetyAlert = {
  type: "ALLERGY" | "INTERACTION";
  severity: "WARNING" | "BLOCKING";
  message: string;
  drugName: string;
};

export type SafetyCheckResult = {
  alerts: SafetyAlert[];
  blocking: boolean;
};

function normalizeIngredient(name: string): string {
  return name.trim().toLowerCase();
}

export async function checkPrescriptionSafety(
  db: TenantClient,
  organizationId: string,
  patientId: string,
  items: PrescriptionItemInput[],
): Promise<SafetyCheckResult> {
  const settings = await getOrCreatePrescriptionSettings(db, organizationId);
  const alerts: SafetyAlert[] = [];

  const allergies = await db.allergy.findMany({
    where: { patientId, organizationId, deletedAt: null },
  });

  const catalogIds = items
    .map((i) => i.drugCatalogId)
    .filter((id): id is string => Boolean(id));

  const drugs = catalogIds.length
    ? await adminPrisma.drugCatalog.findMany({
        where: { id: { in: catalogIds } },
      })
    : [];

  const drugById = new Map(drugs.map((d) => [d.id, d]));
  const ingredients = items.map((item) => {
    const drug = item.drugCatalogId ? drugById.get(item.drugCatalogId) : null;
    return normalizeIngredient(
      drug?.activeIngredient ?? item.drugName.split(" ")[0] ?? item.drugName,
    );
  });

  for (const item of items) {
    const drug = item.drugCatalogId ? drugById.get(item.drugCatalogId) : null;
    const ingredient = normalizeIngredient(
      drug?.activeIngredient ?? item.drugName,
    );

    for (const allergy of allergies) {
      const substance = normalizeIngredient(allergy.substance);
      if (
        ingredient.includes(substance) ||
        substance.includes(ingredient) ||
        normalizeIngredient(item.drugName).includes(substance)
      ) {
        alerts.push({
          type: "ALLERGY",
          severity: "BLOCKING",
          message: `Paciente alérgico a ${allergy.substance}`,
          drugName: item.drugName,
        });
      }
    }
  }

  const uniqueIngredients = Array.from(new Set(ingredients.filter(Boolean)));
  for (let i = 0; i < uniqueIngredients.length; i++) {
    for (let j = i + 1; j < uniqueIngredients.length; j++) {
      const a = uniqueIngredients[i];
      const b = uniqueIngredients[j];
      const interaction = await adminPrisma.drugInteraction.findFirst({
        where: {
          OR: [
            { activeIngredientA: a, activeIngredientB: b },
            { activeIngredientA: b, activeIngredientB: a },
          ],
        },
      });
      if (interaction) {
        alerts.push({
          type: "INTERACTION",
          severity: interaction.severity === "BLOCKING" ? "BLOCKING" : "WARNING",
          message: interaction.description,
          drugName: `${a} + ${b}`,
        });
      }
    }
  }

  const blockingAlerts = alerts.filter((a) => {
    if (a.type === "ALLERGY" && settings.blockOnAllergyConflict) return true;
    if (a.type === "INTERACTION" && a.severity === "BLOCKING" && settings.blockOnDrugInteraction)
      return true;
    if (a.type === "INTERACTION" && a.severity === "WARNING" && settings.blockOnDrugInteraction)
      return true;
    return false;
  });

  return { alerts, blocking: blockingAlerts.length > 0 };
}
