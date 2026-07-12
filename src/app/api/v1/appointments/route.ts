import { withApiRoute } from "@/modules/api/lib/router";
import {
  listAppointments,
  createAppointmentHandler,
} from "@/modules/api/handlers/appointments.handler";

export const GET = withApiRoute({ scopes: ["appointments:read"] }, (req, ctx) =>
  listAppointments(req, ctx),
);

export const POST = withApiRoute(
  { scopes: ["appointments:write"], requireIdempotency: true },
  (req, ctx) => createAppointmentHandler(req, ctx),
);
