import { withApiRoute } from "@/modules/api/lib/router";
import { listInsurers } from "@/modules/api/handlers/resources.handler";

export const GET = withApiRoute({ scopes: ["insurance:read"] }, (req, ctx) =>
  listInsurers(req, ctx),
);
