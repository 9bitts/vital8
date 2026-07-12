import { isS3Configured } from "./s3-config";
import { LocalStorageAdapter } from "./local.adapter";
import { S3StorageAdapter } from "./s3.adapter";
import type { StorageAdapter } from "./types";

let adapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!adapter) {
    adapter = isS3Configured() ? new S3StorageAdapter() : new LocalStorageAdapter();
  }
  return adapter;
}

export function resetStorageAdapter() {
  adapter = null;
}

export { isS3Configured } from "./s3-config";
export type { StorageAdapter, StoredFile } from "./types";
