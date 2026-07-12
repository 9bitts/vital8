import type { AdsAdapter, AdsEventPayload } from "./types";

const FORBIDDEN_KEYS = [
  "diagnosis",
  "cid",
  "prontuario",
  "exam",
  "health",
  "patient_name",
  "cpf",
  "cns",
];

export class MockAdsAdapter implements AdsAdapter {
  private events: AdsEventPayload[] = [];

  getPixelId(): string | null {
    return "MOCK_PIXEL_ID";
  }

  async trackEvent(payload: AdsEventPayload): Promise<void> {
    this.assertNoSensitiveData(payload);
    this.events.push(payload);
    if (process.env.NODE_ENV === "development") {
      console.log("[MockAds]", payload.event, payload.eventId);
    }
  }

  getEventsForTests() {
    return this.events;
  }

  clearForTests() {
    this.events = [];
  }

  private assertNoSensitiveData(payload: AdsEventPayload) {
    const json = JSON.stringify(payload).toLowerCase();
    for (const key of FORBIDDEN_KEYS) {
      if (json.includes(key)) {
        throw new Error(`Dado sensível proibido em evento ads: ${key}`);
      }
    }
  }
}

export class MetaConversionsAdapter implements AdsAdapter {
  getPixelId(): string | null {
    return process.env.META_PIXEL_ID ?? null;
  }

  async trackEvent(payload: AdsEventPayload): Promise<void> {
    if (!payload.consentGranted) return;
    const adapter = new MockAdsAdapter();
    await adapter.trackEvent(payload);
  }
}
