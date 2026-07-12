import { withApiRoute } from "@/modules/api/lib/router";
import { getOrganization } from "@/modules/api/handlers/resources.handler";

export const GET = withApiRoute({}, async (_req, ctx) => getOrganization(ctx));
