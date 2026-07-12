import { withApiRoute } from "@/modules/api/lib/router";
import { listEncounters } from "@/modules/api/handlers/resources.handler";

export const GET = withApiRoute({ scopes: ["encounters:read"] }, (req, ctx) =>
  listEncounters(req, ctx),
);
