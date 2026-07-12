import { NextResponse } from "next/server";
import { withApiRoute } from "@/modules/api/lib/router";
import { ApiError } from "@/modules/api/lib/errors";
import { hasOrgFeature } from "@/lib/features/subscription.service";
import { reconcileLabResult } from "@/modules/interoperability/services/lab-reconciliation.service";
import type { LabResultPayload } from "@/lib/integrations/lab-integration";
import type { ApiContext } from "@/modules/api/middleware/authenticate";

export const dynamic = "force-dynamic";

async function assertLabInbound(ctx: ApiContext) {
  const ok = await hasOrgFeature(ctx.organizationId, "interoperability");
  if (!ok) {
    throw new ApiError("FEATURE_DISABLED", "Interoperabilidade disponível no plano ENTERPRISE", 403);
  }
}

export const POST = withApiRoute({ scopes: ["lab:inbound"] }, async (req, ctx) => {
  await assertLabInbound(ctx);

  const body = (await req.json()) as LabResultPayload;
  if (!body.diagnosticReport?.resourceType) {
    throw new ApiError("VALIDATION_ERROR", "Payload FHIR DiagnosticReport obrigatório", 400);
  }

  const result = await reconcileLabResult(ctx.db, ctx.organizationId, body);

  return NextResponse.json({
    data: result,
    contentType: "application/fhir+json",
  });
});
