"use server";

import { adminPrisma } from "@/lib/db/admin-client";
import { mapAuthError, type ActionResult } from "@/lib/auth/guards";
import { respondToConfirmation } from "@/modules/scheduling/services/appointment.service";

export async function getConfirmationDetailsAction(token: string) {
  const confirmation = await adminPrisma.appointmentConfirmation.findUnique({
    where: { token },
    include: {
      appointment: {
        include: {
          service: { select: { name: true } },
          professional: { select: { displayName: true } },
        },
      },
    },
  });

  if (!confirmation || confirmation.status !== "PENDENTE") {
    return null;
  }

  return {
    serviceName: confirmation.appointment.service.name,
    professionalName: confirmation.appointment.professional.displayName,
    startsAt: confirmation.appointment.startsAt.toISOString(),
  };
}

export async function respondToConfirmationAction(
  token: string,
  response: "confirm" | "cancel",
): Promise<ActionResult> {
  try {
    await respondToConfirmation(token, response);
    return { success: true };
  } catch (e) {
    if (e instanceof Error) {
      return { success: false, error: e.message };
    }
    return mapAuthError(e);
  }
}
