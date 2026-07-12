import { withApiRoute } from "@/modules/api/lib/router";
import { listProfessionals } from "@/modules/api/handlers/resources.handler";

export const GET = withApiRoute({ scopes: ["schedule:read"] }, (req, ctx) =>
  listProfessionals(req, ctx),
);
