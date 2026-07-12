export type DrugSearchResult = {
  id: string;
  name: string;
  activeIngredient?: string | null;
  concentration?: string | null;
  pharmaceuticalForm?: string | null;
  route?: string | null;
  isControlled: boolean;
  externalId?: string | null;
};

export type MemedSessionInput = {
  organizationId: string;
  professionalId: string;
  professionalName: string;
  patientExternalId: string;
  patientName: string;
  memedPartnerId?: string;
  memedApiKey?: string;
};

export type MemedSessionResult = {
  embedUrl: string;
  sessionId: string;
};

export type MemedWebhookResult = {
  externalPrescriptionId: string;
  status: "COMPLETED" | "CANCELLED";
  items?: Array<{ drugName: string; dosage: string }>;
};

export interface PrescriptionProviderAdapter {
  readonly providerType: "LOCAL" | "MEMED";
  searchDrugs(query: string, limit?: number): Promise<DrugSearchResult[]>;
  createEmbedSession?(input: MemedSessionInput): Promise<MemedSessionResult>;
  parseWebhook?(payload: unknown): MemedWebhookResult | null;
}
