import type { PushAdapter, PushPayload, PushSubscriptionInput } from "./types";

export class MockPushAdapter implements PushAdapter {
  private sent: Array<{ sub: PushSubscriptionInput; payload: PushPayload }> = [];

  getVapidPublicKey(): string | null {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "MOCK_VAPID_PUBLIC_KEY";
  }

  async send(sub: PushSubscriptionInput, payload: PushPayload): Promise<void> {
    this.sent.push({ sub, payload });
    if (process.env.NODE_ENV === "development") {
      console.log("[MockPush]", payload.title, payload.body);
    }
  }

  getSentForTests() {
    return this.sent;
  }

  clearForTests() {
    this.sent = [];
  }
}

export class WebPushAdapter implements PushAdapter {
  getVapidPublicKey(): string | null {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
  }

  async send(sub: PushSubscriptionInput, payload: PushPayload): Promise<void> {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? "mailto:contato@vital8.local";
    if (!publicKey || !privateKey) {
      throw new Error("VAPID não configurado");
    }
    const webpush = await import("web-push");
    webpush.setVapidDetails(subject, publicKey, privateKey);
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: sub.keys,
      },
      JSON.stringify(payload),
    );
  }
}
