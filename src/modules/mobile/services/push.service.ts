import { adminPrisma } from "@/lib/db/admin-client";
import { getPushAdapter } from "@/lib/integrations/push";
import type { PushPayload } from "@/lib/integrations/push";

export async function sendPushToUser(
  organizationId: string,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  const prefs = await adminPrisma.userNotificationPreference.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (prefs && !prefs.pushEnabled) return 0;

  const category = payload.category;
  if (category && prefs?.pushCategories) {
    const cats = prefs.pushCategories as Record<string, boolean>;
    if (cats[category] === false) return 0;
  }

  const subs = await adminPrisma.pushSubscription.findMany({
    where: { organizationId, userId },
  });
  if (subs.length === 0) return 0;

  const adapter = getPushAdapter();
  let sent = 0;
  for (const sub of subs) {
    try {
      await adapter.send(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;
    } catch {
      /* subscription expirada — ignorar nesta fase */
    }
  }
  return sent;
}
