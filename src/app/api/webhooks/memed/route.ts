import { NextResponse } from "next/server";
import { adminPrisma } from "@/lib/db/admin-client";
import { getPrescriptionProvider } from "@/lib/integrations/prescription-provider";
import { createAuditLog } from "@/modules/core/services/audit.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.MEMED_WEBHOOK_SECRET;
  const signature = request.headers.get("x-memed-signature");
  if (secret && signature !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const provider = getPrescriptionProvider("MEMED");
  const result = provider.parseWebhook?.(payload);
  if (!result) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const rx = await adminPrisma.prescription.findFirst({
    where: { memedExternalId: result.externalPrescriptionId },
  });

  if (rx && result.status === "COMPLETED") {
    await adminPrisma.prescription.update({
      where: { id: rx.id },
      data: { signedAt: new Date() },
    });
    await createAuditLog({
      action: "prescription.memed.webhook",
      organizationId: rx.organizationId,
      entityType: "Prescription",
      entityId: rx.id,
      metadata: { status: result.status },
    });
  }

  return NextResponse.json({ ok: true, prescriptionId: rx?.id ?? null });
}
