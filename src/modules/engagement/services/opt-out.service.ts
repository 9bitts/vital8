import type {
  CommunicationChannel,
  OptOutPurpose,
} from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";

export async function isOptedOut(
  organizationId: string,
  patientId: string,
  channel: CommunicationChannel,
  purpose: OptOutPurpose,
): Promise<boolean> {
  const rows = await adminPrisma.patientOptOut.findMany({
    where: {
      organizationId,
      patientId,
      purpose,
      OR: [{ channel: null }, { channel }],
    },
  });
  return rows.length > 0;
}

export async function setOptOut(
  organizationId: string,
  patientId: string,
  purpose: OptOutPurpose,
  channel?: CommunicationChannel | null,
): Promise<void> {
  await adminPrisma.patientOptOut.deleteMany({
    where: {
      organizationId,
      patientId,
      purpose,
      channel: channel ?? null,
    },
  });
  await adminPrisma.patientOptOut.create({
    data: {
      organizationId,
      patientId,
      purpose,
      channel: channel ?? null,
    },
  });
}

export async function removeOptOut(
  organizationId: string,
  patientId: string,
  purpose: OptOutPurpose,
  channel?: CommunicationChannel | null,
): Promise<void> {
  await adminPrisma.patientOptOut.deleteMany({
    where: {
      organizationId,
      patientId,
      purpose,
      channel: channel ?? null,
    },
  });
}
