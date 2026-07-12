import type { Prisma, RecordResourceType } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";

export type RecordAccessInput = {
  organizationId: string;
  userId?: string | null;
  resourceType: RecordResourceType;
  resourceId: string;
  action?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function logRecordAccess(input: RecordAccessInput) {
  return adminPrisma.recordAccessLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      action: input.action ?? "view",
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    },
  });
}

export async function listPatientAccessLogs(
  organizationId: string,
  patientId: string,
  limit = 100,
) {
  const encounters = await adminPrisma.encounter.findMany({
    where: { organizationId, patientId },
    select: { id: true },
  });
  const encounterIds = encounters.map((e) => e.id);

  return adminPrisma.recordAccessLog.findMany({
    where: {
      organizationId,
      OR: [
        { resourceId: { in: encounterIds }, resourceType: "ENCOUNTER" },
        {
          metadata: {
            path: ["patientId"],
            equals: patientId,
          },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
