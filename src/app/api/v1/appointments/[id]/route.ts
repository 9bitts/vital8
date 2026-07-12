import { withApiRoute } from "@/modules/api/lib/router";
import { getAppointment } from "@/modules/api/handlers/appointments.handler";

export const GET = withApiRoute({ scopes: ["appointments:read"] }, (_req, ctx, params) =>
  getAppointment(ctx, params!.id),
);
