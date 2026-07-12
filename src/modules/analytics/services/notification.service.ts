import type { NotificationType, Prisma } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";
import { getGoalProgress, listGoals } from "./goal.service";

export async function listNotifications(
  organizationId: string,
  userId: string,
  unreadOnly = false,
) {
  return adminPrisma.userNotification.findMany({
    where: {
      organizationId,
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function countUnread(organizationId: string, userId: string) {
  return adminPrisma.userNotification.count({
    where: { organizationId, userId, readAt: null },
  });
}

export async function markRead(
  notificationId: string,
  organizationId: string,
  userId: string,
) {
  return adminPrisma.userNotification.updateMany({
    where: { id: notificationId, organizationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(organizationId: string, userId: string) {
  return adminPrisma.userNotification.updateMany({
    where: { organizationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function createNotification(input: {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}) {
  return adminPrisma.userNotification.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function scanAndNotify(organizationId: string) {
  const admins = await adminPrisma.membership.findMany({
    where: {
      organizationId,
      role: { in: ["OWNER", "ADMIN"] },
      isActive: true,
    },
    select: { userId: true },
  });

  const critical = await adminPrisma.product.count({
    where: { organizationId, isActive: true, minStock: { gt: 0 } },
  });
  void critical;

  const openCash = await adminPrisma.cashRegister.count({
    where: { organizationId, status: "ABERTO" },
  });

  if (openCash > 0) {
    for (const a of admins) {
      await createNotification({
        organizationId,
        userId: a.userId,
        type: "CASH_REGISTER_OPEN",
        title: "Caixa não fechado",
        body: "Há caixa aberto ao final do dia.",
      });
    }
  }

  const detractors = await adminPrisma.npsResponse.findMany({
    where: {
      organizationId,
      score: { lte: 6 },
      respondedAt: { gte: new Date(Date.now() - 86400000) },
    },
    take: 5,
  });

  for (const d of detractors) {
    for (const a of admins) {
      await createNotification({
        organizationId,
        userId: a.userId,
        type: "NPS_DETRACTOR",
        title: "Detrator NPS",
        body: `Nova avaliação ${d.score}/10 recebida.`,
        metadata: { responseId: d.id },
      });
    }
  }

  await scanGoalThresholds(organizationId, admins.map((a) => a.userId));
}

export async function scanGoalThresholds(organizationId: string, adminUserIds: string[]) {
  const now = new Date();
  const goals = await listGoals(organizationId, now.getFullYear(), now.getMonth() + 1);

  for (const goal of goals) {
    const progress = await getGoalProgress(organizationId, goal.id);
    const pct = progress.progressPct;
    if (pct < 80) continue;

    const threshold = pct >= 100 ? "100" : "80";
    const dedupeKey = `goal:${goal.id}:${threshold}:${now.getFullYear()}-${now.getMonth() + 1}`;

    for (const userId of adminUserIds) {
      const existing = await adminPrisma.userNotification.findFirst({
        where: {
          organizationId,
          userId,
          type: "GOAL_PROGRESS",
          metadata: { path: ["dedupeKey"], equals: dedupeKey },
        },
      });
      if (existing) continue;

      await createNotification({
        organizationId,
        userId,
        type: "GOAL_PROGRESS",
        title: pct >= 100 ? "Meta atingida" : "Meta em 80%",
        body: `${goal.goalType}: ${pct}% do objetivo (${goal.month}/${goal.year}).`,
        metadata: { dedupeKey, goalId: goal.id, progressPct: pct },
      });
    }
  }
}

export async function getNotificationPreferences(userId: string, organizationId: string) {
  return adminPrisma.userNotificationPreference.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    create: { userId, organizationId },
    update: {},
  });
}

export async function saveNotificationPreferences(
  userId: string,
  organizationId: string,
  input: {
    inAppEnabled?: boolean;
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    categories?: Record<string, boolean>;
    pushCategories?: Record<string, boolean>;
  },
) {
  return adminPrisma.userNotificationPreference.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    create: {
      userId,
      organizationId,
      inAppEnabled: input.inAppEnabled ?? true,
      emailEnabled: input.emailEnabled ?? false,
      pushEnabled: input.pushEnabled ?? true,
      categories: input.categories ?? {},
      pushCategories: input.pushCategories ?? {},
    },
    update: input,
  });
}
