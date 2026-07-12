import { withApiRoute } from "@/modules/api/lib/router";
import { rescheduleAppointmentHandler } from "@/modules/api/handlers/appointments.handler";

export const POST = withApiRoute({ scopes: ["appointments:write"] }, (req, ctx, params) =>
  rescheduleAppointmentHandler(ctx, params!.id, req),
);
