import type { TissSequenceType } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";
import type { TenantClient } from "@/lib/db/tenant-client";

export async function nextSequenceNumber(
  _db: TenantClient,
  organizationId: string,
  healthInsurerId: string,
  sequenceType: TissSequenceType,
): Promise<number> {
  return adminPrisma.$transaction(
    async (tx) => {
      const existing = await tx.tissSequence.findUnique({
        where: {
          organizationId_healthInsurerId_sequenceType: {
            organizationId,
            healthInsurerId,
            sequenceType,
          },
        },
      });

      if (existing) {
        const updated = await tx.tissSequence.update({
          where: { id: existing.id },
          data: { lastNumber: { increment: 1 } },
        });
        return updated.lastNumber;
      }

      const created = await tx.tissSequence.create({
        data: {
          organizationId,
          healthInsurerId,
          sequenceType,
          lastNumber: 1,
        },
      });
      return created.lastNumber;
    },
    { isolationLevel: "Serializable" },
  );
}
