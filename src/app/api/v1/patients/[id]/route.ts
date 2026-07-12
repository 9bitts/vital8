import { withApiRoute } from "@/modules/api/lib/router";
import {
  getPatient,
  deactivatePatient,
} from "@/modules/api/handlers/patients.handler";

export const GET = withApiRoute({ scopes: ["patients:read"] }, (_req, ctx, params) =>
  getPatient(ctx, params!.id),
);

export const DELETE = withApiRoute({ scopes: ["patients:write"] }, (req, ctx, params) =>
  deactivatePatient(ctx, params!.id, req),
);
