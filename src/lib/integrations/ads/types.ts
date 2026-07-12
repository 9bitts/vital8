export type AdsEventName =
  | "page_view"
  | "lead"
  | "schedule"
  | "attendance";

export type AdsEventPayload = {
  event: AdsEventName;
  eventId: string;
  url?: string;
  /** Apenas hashes — nunca PHI */
  userData?: Record<string, string>;
  customData?: Record<string, string | number>;
  consentGranted: boolean;
};

export interface AdsAdapter {
  trackEvent(payload: AdsEventPayload): Promise<void>;
  getPixelId(): string | null;
}

export type { AdsEventPayload as AdsPayload };
