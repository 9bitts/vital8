export type DrugSearchResult = {
  id: string;
  name: string;
  activeIngredient?: string | null;
  concentration?: string | null;
  pharmaceuticalForm?: string | null;
  route?: string | null;
  isControlled: boolean;
};

export interface PrescriptionProviderAdapter {
  searchDrugs(query: string, limit?: number): Promise<DrugSearchResult[]>;
}
