import { withApiRoute } from "@/modules/api/lib/router";
import { listProducts } from "@/modules/api/handlers/resources.handler";

export const GET = withApiRoute({ scopes: ["stock:read"] }, (req, ctx) =>
  listProducts(req, ctx),
);
