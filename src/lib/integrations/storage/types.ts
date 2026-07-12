export type StoredFile = {
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

export interface StorageAdapter {
  upload(
    organizationId: string,
    patientId: string,
    fileName: string,
    mimeType: string,
    data: Buffer,
  ): Promise<StoredFile>;

  download(storageKey: string): Promise<Buffer>;

  delete(storageKey: string): Promise<void>;

  /** URL temporária para download (S3). */
  getSignedUrl?(storageKey: string, expiresInSeconds?: number): Promise<string>;
}
