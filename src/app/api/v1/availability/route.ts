import { withApiRoute } from "@/modules/api/lib/router";
import { listAvailability } from "@/modules/api/handlers/appointments.handler";

export const GET = withApiRoute({ scopes: ["schedule:read"] }, (req, ctx) =>
  listAvailability(req, ctx),
);
