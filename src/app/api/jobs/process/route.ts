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

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.JOBS_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await adminPrisma.organization.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true },
  });

  for (const org of orgs) {
    await runAutomationScanners(org.id);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    await reprocessMetricsRange(org.id, from, to);
    await scanAndNotify(org.id);
    await processScheduledReports(org.id);
  }

  const result = await processCommunicationQueue(100);
  await processWebhookDeliveries(50);

  return NextResponse.json({
    ok: true,
    ...result,
    idempotent: true,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
