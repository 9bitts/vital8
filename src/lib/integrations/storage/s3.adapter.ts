import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  buildS3Key,
  getS3Bucket,
  getS3Region,
  isS3Configured,
} from "./s3-config";
import type { StorageAdapter, StoredFile } from "./types";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: getS3Region(),
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
      },
    });
  }
  return client;
}

export class S3StorageAdapter implements StorageAdapter {
  readonly provider = "s3";

  async upload(
    organizationId: string,
    patientId: string,
    fileName: string,
    mimeType: string,
    data: Buffer,
  ): Promise<StoredFile> {
    if (!isS3Configured()) {
      throw new Error("AWS S3 não configurado");
    }

    const storageKey = buildS3Key(organizationId, patientId, fileName);
    await getClient().send(
      new PutObjectCommand({
        Bucket: getS3Bucket(),
        Key: storageKey,
        Body: data,
        ContentType: mimeType,
      }),
    );

    return {
      storageKey,
      fileName,
      mimeType,
      fileSize: data.length,
    };
  }

  async download(storageKey: string): Promise<Buffer> {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: getS3Bucket(), Key: storageKey }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error("Arquivo vazio no S3");
    return Buffer.from(bytes);
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await getClient().send(
        new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: storageKey }),
      );
    } catch {
      /* non-fatal */
    }
  }

  async getSignedUrl(
    storageKey: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    return getSignedUrl(
      getClient(),
      new GetObjectCommand({ Bucket: getS3Bucket(), Key: storageKey }),
      { expiresIn: expiresInSeconds },
    );
  }
}
