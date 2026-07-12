import { withApiRoute } from "@/modules/api/lib/router";
import {
  listPatientAllergies,
  listPatientConditions,
} from "@/modules/api/handlers/patients.handler";

export const GET = withApiRoute({ scopes: ["patients:read"] }, async (_req, ctx, params) => {
  const allergies = await listPatientAllergies(ctx, params!.id);
  const conditions = await listPatientConditions(ctx, params!.id);
  const allergyData = await allergies.json();
  const conditionData = await conditions.json();
  return Response.json({
    data: {
      allergies: allergyData.data,
      conditions: conditionData.data,
    },
    meta: {},
  });
});
