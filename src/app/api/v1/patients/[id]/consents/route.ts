import { withApiRoute } from "@/modules/api/lib/router";
import { listPatientConsents } from "@/modules/api/handlers/patients.handler";

export const GET = withApiRoute({ scopes: ["patients:read"] }, (_req, ctx, params) =>
  listPatientConsents(ctx, params!.id),
);
