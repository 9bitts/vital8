/** Tipos compartilhados offline (client + testes). */

export type OfflineActionType =
  | "CONFIRM_APPOINTMENT"
  | "MARK_NO_SHOW"
  | "START_APPOINTMENT"
  | "FINISH_APPOINTMENT"
  | "CALL_PATIENT"
  | "BLOCK_SLOT"
  | "CREATE_PROVISIONAL_APPOINTMENT"
  | "PERSONAL_NOTE";

export type OfflineActionStatus = "PENDING" | "SYNCING" | "APPLIED" | "REJECTED" | "CONFLICT";

export type OfflineAction = {
  id: string;
  type: OfflineActionType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  expectedUpdatedAt?: string | null;
  status: OfflineActionStatus;
  createdAt: string;
  errorMessage?: string | null;
  serverResponse?: unknown;
};

export type AgendaSnapshot = {
  syncedAt: string;
  windowFrom: string;
  windowTo: string;
  appointments: Array<Record<string, unknown>>;
  patients: Array<{
    id: string;
    fullName: string;
    phone?: string | null;
    insurerName?: string | null;
    allergies: string[];
  }>;
};

export type OfflineStoreData = {
  snapshot: AgendaSnapshot | null;
  actionQueue: OfflineAction[];
  pendingConflicts: OfflineAction[];
  lastSyncAt: string | null;
};

export const OFFLINE_ROLES = ["PROFISSIONAL_SAUDE", "RECEPCAO"] as const;

export const SNAPSHOT_WINDOW_DAYS_BACK = 7;
export const SNAPSHOT_WINDOW_DAYS_FORWARD = 14;
