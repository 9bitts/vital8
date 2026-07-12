"use client";

import {
  markActionStatus,
  moveToConflict,
  nextPendingAction,
  sortQueueByCreatedAt,
} from "./queue-logic";
import { readOfflineStore, updateOfflineStore } from "./store.client";
import type { OfflineAction, OfflineActionType } from "./types";

export async function getOfflineQueue(): Promise<OfflineAction[]> {
  const store = await readOfflineStore();
  return sortQueueByCreatedAt(store.actionQueue);
}

export async function getPendingConflicts(): Promise<OfflineAction[]> {
  const store = await readOfflineStore();
  return store.pendingConflicts;
}

export async function addToQueue(
  type: OfflineActionType,
  payload: Record<string, unknown>,
  userId: string,
  expectedUpdatedAt?: string | null,
): Promise<OfflineAction> {
  const id = crypto.randomUUID();
  const action: OfflineAction = {
    id,
    type,
    payload,
    idempotencyKey: `offline-${userId}-${id}`,
    expectedUpdatedAt: expectedUpdatedAt ?? null,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  await updateOfflineStore((s) => ({
    ...s,
    actionQueue: [...s.actionQueue, action],
  }));
  return action;
}

export async function dismissConflict(actionId: string): Promise<void> {
  await updateOfflineStore((s) => ({
    ...s,
    pendingConflicts: s.pendingConflicts.filter((a) => a.id !== actionId),
  }));
}

type SyncResult = {
  applied: number;
  rejected: number;
  pending: number;
};

export async function processOfflineQueue(): Promise<SyncResult> {
  let applied = 0;
  let rejected = 0;

  for (;;) {
    const store = await readOfflineStore();
    const next = nextPendingAction(store.actionQueue);
    if (!next) break;

    await updateOfflineStore((s) => ({
      ...s,
      actionQueue: markActionStatus(s.actionQueue, next.id, "SYNCING"),
    }));

    const res = await fetch("/api/mobile/sync/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": next.idempotencyKey,
      },
      body: JSON.stringify({
        actionId: next.id,
        type: next.type,
        payload: next.payload,
        expectedUpdatedAt: next.expectedUpdatedAt,
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      applied++;
      await updateOfflineStore((s) => ({
        ...s,
        actionQueue: s.actionQueue.filter((a) => a.id !== next.id),
      }));
    } else if (res.status === 409 || body?.error?.code) {
      rejected++;
      await updateOfflineStore((s) => {
        const { queue, conflict } = moveToConflict(
          s.actionQueue,
          next.id,
          body?.error?.message ?? "Conflito de sincronização",
          body,
        );
        return {
          ...s,
          actionQueue: queue,
          pendingConflicts: [...s.pendingConflicts, conflict],
        };
      });
    } else {
      await updateOfflineStore((s) => ({
        ...s,
        actionQueue: markActionStatus(s.actionQueue, next.id, "PENDING", {
          errorMessage: body?.error?.message ?? "Erro de rede",
        }),
      }));
      break;
    }
  }

  const finalStore = await readOfflineStore();
  return {
    applied,
    rejected,
    pending: finalStore.actionQueue.filter((a) => a.status === "PENDING").length,
  };
}

export async function pullAgendaSnapshot(): Promise<string | null> {
  const res = await fetch("/api/mobile/sync/appointments");
  if (!res.ok) return null;
  const json = await res.json();
  const syncedAt = new Date().toISOString();
  await updateOfflineStore((s) => ({
    ...s,
    snapshot: json.data,
    lastSyncAt: syncedAt,
  }));
  return syncedAt;
}

export async function syncWhenOnline(): Promise<SyncResult & { snapshotAt: string | null }> {
  const snapshotAt = await pullAgendaSnapshot();
  const result = await processOfflineQueue();
  return { ...result, snapshotAt };
}
