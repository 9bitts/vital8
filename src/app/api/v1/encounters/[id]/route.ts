import { withApiRoute } from "@/modules/api/lib/router";
import { getEncounter } from "@/modules/api/handlers/resources.handler";

export const GET = withApiRoute({ scopes: ["encounters:read"] }, (req, ctx, params) =>
  getEncounter(ctx, params!.id, req),
);
