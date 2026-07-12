/** Escopos estáveis da API v1 — recurso:ação */
export const API_SCOPES = [
  "patients:read",
  "patients:write",
  "appointments:read",
  "appointments:write",
  "schedule:read",
  "encounters:read",
  "documents:read",
  "financial:read",
  "financial:write",
  "insurance:read",
  "stock:read",
  "webhooks:manage",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export function hasScope(granted: string[], required: ApiScope | ApiScope[]): boolean {
  const needed = Array.isArray(required) ? required : [required];
  return needed.every((s) => granted.includes(s));
}

export const RATE_LIMITS_BY_PLAN = {
  BASICO: 60,
  PRO: 300,
  ENTERPRISE: 1000,
} as const;

export const DEMO_ORG_SLUG = "clinica-vida-plena";

export const WEBHOOK_EVENTS = [
  "patient.created",
  "patient.updated",
  "appointment.created",
  "appointment.updated",
  "appointment.status_changed",
  "appointment.cancelled",
  "encounter.signed",
  "document.released",
  "payment.received",
  "receivable.overdue",
  "tiss.glosa_received",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];
