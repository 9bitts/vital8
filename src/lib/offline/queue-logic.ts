/**
 * Lógica pura da fila offline — testável sem browser.
 */

import type { OfflineAction, OfflineActionStatus } from "./types";

export function sortQueueByCreatedAt(actions: OfflineAction[]): OfflineAction[] {
  return [...actions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function nextPendingAction(queue: OfflineAction[]): OfflineAction | null {
  const pending = sortQueueByCreatedAt(queue).find((a) => a.status === "PENDING");
  return pending ?? null;
}

export function markActionStatus(
  queue: OfflineAction[],
  actionId: string,
  status: OfflineActionStatus,
  extra?: Partial<OfflineAction>,
): OfflineAction[] {
  return queue.map((a) =>
    a.id === actionId ? { ...a, ...extra, status } : a,
  );
}

export function moveToConflict(
  queue: OfflineAction[],
  actionId: string,
  errorMessage: string,
  serverResponse?: unknown,
): { queue: OfflineAction[]; conflict: OfflineAction } {
  const action = queue.find((a) => a.id === actionId);
  if (!action) throw new Error("Ação não encontrada");
  const conflict: OfflineAction = {
    ...action,
    status: "CONFLICT",
    errorMessage,
    serverResponse,
  };
  return {
    queue: queue.filter((a) => a.id !== actionId),
    conflict,
  };
}

export function generateIdempotencyKey(actionId: string, userId: string): string {
  return `offline-${userId}-${actionId}`;
}

export function isConflictError(code: string): boolean {
  return ["SLOT_CONFLICT", "INVALID_TRANSITION", "VERSION_MISMATCH"].includes(code);
}
