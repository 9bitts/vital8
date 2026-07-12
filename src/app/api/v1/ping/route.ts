import { withApiRoute } from "@/modules/api/lib/router";
import { apiSuccess } from "@/modules/api/lib/response";

export const GET = withApiRoute({}, async (_req, ctx) =>
  apiSuccess({
    ok: true,
    client: ctx.clientName,
    environment: ctx.environment,
    scopes: ctx.scopes,
    organizationId: ctx.organizationId,
  }),
);
