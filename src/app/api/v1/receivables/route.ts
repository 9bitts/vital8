import { withApiRoute } from "@/modules/api/lib/router";
import { listReceivables } from "@/modules/api/handlers/resources.handler";

export const GET = withApiRoute({ scopes: ["financial:read"] }, (req, ctx) =>
  listReceivables(req, ctx),
);
