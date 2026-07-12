export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  category?: string;
};

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export interface PushAdapter {
  send(userSubscription: PushSubscriptionInput, payload: PushPayload): Promise<void>;
  getVapidPublicKey(): string | null;
}
