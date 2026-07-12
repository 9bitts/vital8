import { decryptPHI } from "@/lib/crypto/phi";
import type { TenantClient } from "@/lib/db/tenant-client";
import { findValidAuthorization } from "./authorization.service";

export type EligibilityAlert = {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
};

export type EligibilityResult = {
  eligible: boolean;
  alerts: EligibilityAlert[];
  requiresAuthorization: boolean;
  authorizationId?: string;
};

export async function checkAppointmentEligibility(
  db: TenantClient,
  appointmentId: string,
): Promise<EligibilityResult> {
  const appointment = await db.appointment.findFirstOrThrow({
    where: { id: appointmentId },
    include: {
      service: { include: { tussProcedure: true } },
      patientInsurancePlan: { include: { healthInsurer: true } },
    },
  });

  if (appointment.isPrivate) {
    return { eligible: true, alerts: [], requiresAuthorization: false };
  }

  const alerts: EligibilityAlert[] = [];
  const plan = appointment.patientInsurancePlan;

  if (!plan) {
    alerts.push({
      level: "error",
      code: "NO_INSURANCE",
      message: "Atendimento por convênio sem carteirinha vinculada",
    });
    return { eligible: false, alerts, requiresAuthorization: false };
  }

  let cardNumber = "";
  try {
    cardNumber = decryptPHI(plan.cardNumberEncrypted);
  } catch {
    alerts.push({
      level: "error",
      code: "CARD_DECRYPT",
      message: "Não foi possível ler a carteirinha",
    });
  }

  if (!cardNumber.trim()) {
    alerts.push({
      level: "error",
      code: "EMPTY_CARD",
      message: "Número da carteirinha ausente",
    });
  }

  if (plan.validUntil && plan.validUntil < new Date()) {
    alerts.push({
      level: "error",
      code: "CARD_EXPIRED",
      message: "Carteirinha vencida",
    });
  }

  if (!appointment.service.tussProcedureId && !appointment.service.tussCode) {
    alerts.push({
      level: "error",
      code: "NO_TUSS",
      message: "Serviço sem mapeamento TUSS — faturamento bloqueado",
    });
  }

  const insurer = plan.healthInsurer;
  const requiresAuthorization = insurer?.requiresAuthorization ?? false;
  let authorizationId: string | undefined;

  if (requiresAuthorization && insurer) {
    const auth = await findValidAuthorization(
      db,
      insurer.id,
      appointment.patientId,
      appointment.serviceId,
    );
    if (!auth) {
      alerts.push({
        level: "warning",
        code: "AUTH_REQUIRED",
        message: "Requer autorização da operadora",
      });
    } else {
      authorizationId = auth.id;
      if (auth.consumedQty >= auth.authorizedQty) {
        alerts.push({
          level: "error",
          code: "AUTH_EXHAUSTED",
          message: "Quantidade autorizada esgotada",
        });
      }
    }
  }

  const eligible = !alerts.some((a) => a.level === "error");
  return { eligible, alerts, requiresAuthorization, authorizationId };
}
