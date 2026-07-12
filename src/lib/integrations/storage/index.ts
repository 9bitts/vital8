import { LocalStorageAdapter } from "./local.adapter";
import type { StorageAdapter } from "./types";

let adapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!adapter) {
    adapter = new LocalStorageAdapter();
  }
  return adapter;
}

export type { StorageAdapter, StoredFile } from "./types";
