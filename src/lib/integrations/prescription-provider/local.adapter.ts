import { adminPrisma } from "@/lib/db/admin-client";
import type {
  DrugSearchResult,
  PrescriptionProviderAdapter,
} from "./types";

/** Provider local usando DrugCatalog — interface compatível com Memed futuro. */
export class LocalDrugCatalogAdapter implements PrescriptionProviderAdapter {
  async searchDrugs(query: string, limit = 20): Promise<DrugSearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const drugs = await adminPrisma.drugCatalog.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { activeIngredient: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { name: "asc" },
    });

    return drugs.map((d) => ({
      id: d.id,
      name: d.name,
      activeIngredient: d.activeIngredient,
      concentration: d.concentration,
      pharmaceuticalForm: d.pharmaceuticalForm,
      route: d.route,
      isControlled: d.isControlled,
    }));
  }
}
