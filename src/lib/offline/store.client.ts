"use client";

import { openDB, type IDBPDatabase } from "idb";
import {
  decryptPayload,
  deriveCacheKey,
  encryptPayload,
  generateSalt,
} from "./crypto.client";
import type { OfflineStoreData } from "./types";

const DB_NAME = "vital8-offline";
const DB_VERSION = 1;
const STORE_KEY = "encrypted-data";
const META_KEY = "meta";

type MetaRecord = { salt: string; keyMaterial: string };

let dbPromise: Promise<IDBPDatabase> | null = null;
let cacheKey: CryptoKey | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("store")) {
          db.createObjectStore("store");
        }
      },
    });
  }
  return dbPromise;
}

export async function initOfflineStore(keyMaterial: string, existingSalt?: string) {
  const salt = existingSalt ?? generateSalt();
  cacheKey = await deriveCacheKey(keyMaterial, salt);
  const db = await getDb();
  const tx = db.transaction("store", "readwrite");
  await tx.store.put({ salt, keyMaterial } satisfies MetaRecord, META_KEY);
  await tx.done;
  return salt;
}

async function ensureKey(): Promise<CryptoKey> {
  if (cacheKey) return cacheKey;
  const db = await getDb();
  const meta = (await db.get("store", META_KEY)) as MetaRecord | undefined;
  if (!meta) throw new Error("Cache offline não inicializado");
  cacheKey = await deriveCacheKey(meta.keyMaterial, meta.salt);
  return cacheKey;
}

const EMPTY: OfflineStoreData = {
  snapshot: null,
  actionQueue: [],
  pendingConflicts: [],
  lastSyncAt: null,
};

export async function readOfflineStore(): Promise<OfflineStoreData> {
  try {
    const key = await ensureKey();
    const db = await getDb();
    const encrypted = await db.get("store", STORE_KEY);
    if (!encrypted || typeof encrypted !== "string") return { ...EMPTY };
    const json = await decryptPayload(key, encrypted);
    return JSON.parse(json) as OfflineStoreData;
  } catch {
    return { ...EMPTY };
  }
}

export async function writeOfflineStore(data: OfflineStoreData): Promise<void> {
  const key = await ensureKey();
  const db = await getDb();
  const encrypted = await encryptPayload(key, JSON.stringify(data));
  const tx = db.transaction("store", "readwrite");
  await tx.store.put(encrypted, STORE_KEY);
  await tx.done;
}

export async function purgeOfflineStore(): Promise<void> {
  cacheKey = null;
  dbPromise = null;
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

export async function enqueueOfflineAction(
  action: OfflineStoreData["actionQueue"][number],
): Promise<void> {
  const store = await readOfflineStore();
  store.actionQueue.push(action);
  await writeOfflineStore(store);
}

export async function updateOfflineStore(
  updater: (data: OfflineStoreData) => OfflineStoreData,
): Promise<OfflineStoreData> {
  const current = await readOfflineStore();
  const next = updater(current);
  await writeOfflineStore(next);
  return next;
}
