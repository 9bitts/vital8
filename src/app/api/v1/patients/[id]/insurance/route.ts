import { withApiRoute } from "@/modules/api/lib/router";
import { listPatientInsurance } from "@/modules/api/handlers/patients.handler";

export const GET = withApiRoute({ scopes: ["patients:read", "insurance:read"] }, (_req, ctx, params) =>
  listPatientInsurance(ctx, params!.id),
);
