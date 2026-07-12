import { NextResponse } from "next/server";
import { adminPrisma } from "@/lib/db/admin-client";
import {
  processCommunicationQueue,
} from "@/modules/engagement/services/queue-processor.service";
import { runAutomationScanners } from "@/modules/engagement/services/automation.service";
import { scanAndNotify } from "@/modules/analytics/services/notification.service";
import { reprocessMetricsRange } from "@/modules/analytics/services/aggregation.service";
import { processScheduledReports } from "@/modules/analytics/services/scheduled-report.service";
import { processWebhookDeliveries } from "@/modules/api/services/webhook.service";
import { processRndsSubmissions, scanPendingRndsSubmissions } from "@/modules/interoperability/services/rnds-submission.service";
import { createTenantClient } from "@/lib/db/tenant-client";
import { runLeadCadenceScanners } from "@/modules/marketing/services/lead-cadence.service";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!assertCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await adminPrisma.organization.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true },
  });

  let rndsEnqueued = 0;
  for (const org of orgs) {
    await runAutomationScanners(org.id);
    const db = createTenantClient(org.id);
    await runLeadCadenceScanners(db, org.id);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    await reprocessMetricsRange(org.id, from, to);
    await scanAndNotify(org.id);
    await processScheduledReports(org.id);
    const scan = await scanPendingRndsSubmissions(org.id);
    rndsEnqueued += scan.enqueued;
  }

  const result = await processCommunicationQueue(100);
  const rndsResult = await processRndsSubmissions(50);
  await processWebhookDeliveries(50);

  return NextResponse.json({
    ok: true,
    ...result,
    rnds: rndsResult,
    rndsEnqueued,
    idempotent: true,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
