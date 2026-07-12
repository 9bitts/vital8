import type { TenantClient } from "@/lib/db/tenant-client";
import { emitFiscalDocument } from "./fiscal-document.service";

export async function processFiscalQueue(
  db: TenantClient,
  organizationId: string,
  limit = 20,
) {
  const pending = await db.fiscalDocument.findMany({
    where: {
      organizationId,
      status: "PENDING",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let issued = 0;
  let failed = 0;

  for (const doc of pending) {
    const result = await emitFiscalDocument(db, organizationId, doc.id);
    if (result.status === "ISSUED") issued += 1;
    else if (result.status === "FAILED") failed += 1;
  }

  return { processed: pending.length, issued, failed };
}
