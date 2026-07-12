import { describe, expect, it } from "vitest";
import {
  generateIdempotencyKey,
  isConflictError,
  markActionStatus,
  moveToConflict,
  nextPendingAction,
  sortQueueByCreatedAt,
} from "./queue-logic";
import type { OfflineAction } from "./types";

function action(id: string, createdAt: string, status: OfflineAction["status"] = "PENDING"): OfflineAction {
  return {
    id,
    type: "CONFIRM_APPOINTMENT",
    payload: { appointmentId: "a1" },
    idempotencyKey: `offline-u1-${id}`,
    status,
    createdAt,
  };
}

describe("offline queue logic", () => {
  it("ordena fila por createdAt", () => {
    const sorted = sortQueueByCreatedAt([
      action("b", "2025-01-02T10:00:00Z"),
      action("a", "2025-01-01T10:00:00Z"),
    ]);
    expect(sorted[0].id).toBe("a");
  });

  it("retorna próxima ação pendente em ordem", () => {
    const q = [
      action("b", "2025-01-02T10:00:00Z"),
      action("a", "2025-01-01T10:00:00Z", "SYNCING"),
      action("c", "2025-01-03T10:00:00Z"),
    ];
    expect(nextPendingAction(q)?.id).toBe("b");
  });

  it("gera idempotency key estável", () => {
    expect(generateIdempotencyKey("act-1", "user-1")).toBe("offline-user-1-act-1");
  });

  it("move ação para conflito sem remover outras", () => {
    const q = [action("x", "2025-01-01T10:00:00Z"), action("y", "2025-01-02T10:00:00Z")];
    const { queue, conflict } = moveToConflict(q, "x", "Horário ocupado");
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("y");
    expect(conflict.status).toBe("CONFLICT");
    expect(conflict.errorMessage).toBe("Horário ocupado");
  });

  it("marca status da ação", () => {
    const q = [action("z", "2025-01-01T10:00:00Z")];
    const next = markActionStatus(q, "z", "SYNCING");
    expect(next[0].status).toBe("SYNCING");
  });

  it("identifica códigos de conflito", () => {
    expect(isConflictError("SLOT_CONFLICT")).toBe(true);
    expect(isConflictError("VERSION_MISMATCH")).toBe(true);
    expect(isConflictError("NETWORK")).toBe(false);
  });
});
