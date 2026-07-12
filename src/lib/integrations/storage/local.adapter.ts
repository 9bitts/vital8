import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { StorageAdapter, StoredFile } from "./types";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export class LocalStorageAdapter implements StorageAdapter {
  private resolvePath(storageKey: string): string {
    return path.join(UPLOAD_ROOT, storageKey);
  }

  async upload(
    organizationId: string,
    patientId: string,
    fileName: string,
    mimeType: string,
    data: Buffer,
  ): Promise<StoredFile> {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = path.join(
      organizationId,
      patientId,
      `${randomUUID()}-${safeName}`,
    );
    const fullPath = this.resolvePath(storageKey);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);

    return {
      storageKey,
      fileName,
      mimeType,
      fileSize: data.length,
    };
  }

  async download(storageKey: string): Promise<Buffer> {
    return readFile(this.resolvePath(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolvePath(storageKey));
    } catch {
      // Arquivo já removido
    }
  }
}
