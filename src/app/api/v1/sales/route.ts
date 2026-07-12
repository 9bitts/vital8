import { withApiRoute } from "@/modules/api/lib/router";
import { listSales } from "@/modules/api/handlers/resources.handler";

export const GET = withApiRoute({ scopes: ["financial:read"] }, (req, ctx) =>
  listSales(req, ctx),
);
