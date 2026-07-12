import { withApiRoute } from "@/modules/api/lib/router";
import {
  listPatients,
  createPatientHandler,
} from "@/modules/api/handlers/patients.handler";

export const GET = withApiRoute({ scopes: ["patients:read"] }, (req, ctx) =>
  listPatients(req, ctx),
);

export const POST = withApiRoute(
  { scopes: ["patients:write"], requireIdempotency: true },
  (req, ctx) => createPatientHandler(req, ctx),
);
