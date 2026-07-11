import type { Prisma } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";

export type AuditLogInput = {
  action: string;
  organizationId?: string | null;
  userId?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function createAuditLog(input: AuditLogInput) {
  return adminPrisma.auditLog.create({
    data: {
      action: input.action,
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function listAuditLogs(
  organizationId: string,
  page: number,
  pageSize: number,
) {
  const db = adminPrisma;
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.auditLog.count({ where: { organizationId } }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
