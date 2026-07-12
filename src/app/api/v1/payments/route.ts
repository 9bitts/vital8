import { withApiRoute } from "@/modules/api/lib/router";
import { listPayments } from "@/modules/api/handlers/resources.handler";

export const GET = withApiRoute({ scopes: ["financial:read"] }, (req, ctx) =>
  listPayments(req, ctx),
);
