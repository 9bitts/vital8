import { withApiRoute } from "@/modules/api/lib/router";
import { cancelAppointment } from "@/modules/api/handlers/appointments.handler";

export const POST = withApiRoute({ scopes: ["appointments:write"] }, (req, ctx, params) =>
  cancelAppointment(ctx, params!.id, req),
);
