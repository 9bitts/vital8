export type RndsEnvironment = "HOMOLOGACAO" | "PRODUCAO";

export type RndsTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type RndsSubmitResult = {
  protocol: string;
  status: "ACEITO" | "REJEITADO";
  response: Record<string, unknown>;
};

export type RndsAdapterConfig = {
  environment: RndsEnvironment;
  requesterId: string;
  certificateEncrypted?: string | null;
  certificateReference?: string | null;
};

export interface RndsAdapter {
  authenticate(config: RndsAdapterConfig): Promise<RndsTokenResponse>;
  submitBundle(
    config: RndsAdapterConfig,
    token: string,
    bundle: Record<string, unknown>,
    registrationType: "RAC" | "EXAM_RESULT",
  ): Promise<RndsSubmitResult>;
  testConnection(config: RndsAdapterConfig): Promise<{ ok: boolean; message: string }>;
}

export const RNDS_ENDPOINTS = {
  HOMOLOGACAO: {
    token: "https://ehr-services.hmg.saude.gov.br/api/token",
    fhir: "https://ehr-services.hmg.saude.gov.br/api/fhir",
  },
  PRODUCAO: {
    token: "https://ehr-services.saude.gov.br/api/token",
    fhir: "https://ehr-services.saude.gov.br/api/fhir",
  },
} as const;
