import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiRoute } from "@/modules/api/lib/router";
import { ApiError } from "@/modules/api/lib/errors";
import { hasOrgFeature } from "@/lib/features/subscription.service";
import {
  FHIR_RESOURCE_SCOPES,
  getFhirResource,
  listFhirResources,
} from "@/modules/fhir/services/fhir-read.service";
import type { ApiContext } from "@/modules/api/middleware/authenticate";

async function assertInteroperability(ctx: ApiContext) {
  const ok = await hasOrgFeature(ctx.organizationId, "interoperability");
  if (!ok) {
    throw new ApiError("FEATURE_DISABLED", "Interoperabilidade disponível no plano ENTERPRISE", 403);
  }
}

export const listFhirHandler = (resourceType: string) =>
  withApiRoute(
    { scopes: FHIR_RESOURCE_SCOPES[resourceType] ?? ["patients:read"] },
    async (req, ctx) => {
      await assertInteroperability(ctx);
      return listFhirResources(req, ctx, resourceType);
    },
  );

export const getFhirHandler = (resourceType: string) =>
  withApiRoute(
    { scopes: FHIR_RESOURCE_SCOPES[resourceType] ?? ["patients:read"] },
    async (_req, ctx, params) => {
      await assertInteroperability(ctx);
      const id = params?.id;
      if (!id) throw new ApiError("VALIDATION_ERROR", "ID obrigatório", 400);
      const resource = await getFhirResource(ctx, resourceType, id);
      return NextResponse.json({ data: resource });
    },
  );

export function createFhirRouteHandler(resourceType: string) {
  return async (req: NextRequest, segment?: { params?: Promise<Record<string, string>> }) => {
    const params = segment?.params ? await segment.params : undefined;
    if (params?.id) {
      return getFhirHandler(resourceType)(req, { params: Promise.resolve(params) });
    }
    return listFhirHandler(resourceType)(req, segment);
  };
}
