export type NfseIssueInput = {
  organizationId: string;
  organizationDocument: string;
  organizationName: string;
  patientName: string;
  patientDocument?: string;
  patientDocumentType?: "CPF" | "CNPJ";
  serviceDescription: string;
  amountCents: number;
  nacionalServiceCode?: string;
  cnae?: string;
  issRateBasisPoints?: number;
  municipioIbgeCode?: string;
  inscricaoMunicipal?: string;
  certificatePfxBase64?: string;
  certificatePassword?: string;
  cbsIbsEnabled?: boolean;
  cbsRateBasisPoints?: number;
  ibsRateBasisPoints?: number;
  paymentId?: string;
  saleId?: string;
};

export type NfseIssueResult = {
  number: string;
  accessKey: string;
  dpsNumber: string;
  pdfBase64: string;
  xmlOrJson: Record<string, unknown>;
  issuedAt: Date;
};

export type NfseConsultResult = {
  accessKey: string;
  status: "ISSUED" | "CANCELLED" | "UNKNOWN";
  number?: string;
  issuedAt?: Date;
};

export interface NfseAdapter {
  issue(input: NfseIssueInput): Promise<NfseIssueResult>;
  consult(accessKey: string): Promise<NfseConsultResult>;
  cancel(accessKey: string, reason: string): Promise<{ cancelledAt: Date }>;
  substitute(
    accessKey: string,
    input: NfseIssueInput,
  ): Promise<NfseIssueResult>;
}
