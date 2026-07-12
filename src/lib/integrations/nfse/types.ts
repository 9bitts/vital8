export type NfseIssueInput = {
  organizationId: string;
  patientName: string;
  serviceDescription: string;
  amountCents: number;
};

export type NfseIssueResult = {
  number: string;
  pdfBase64: string;
  issuedAt: Date;
};

export interface NfseAdapter {
  issue(input: NfseIssueInput): Promise<NfseIssueResult>;
}
