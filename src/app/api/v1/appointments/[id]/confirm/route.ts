import { withApiRoute } from "@/modules/api/lib/router";
import { confirmAppointment } from "@/modules/api/handlers/appointments.handler";

export const POST = withApiRoute({ scopes: ["appointments:write"] }, (_req, ctx, params) =>
  confirmAppointment(ctx, params!.id),
);
