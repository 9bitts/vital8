import type { TenantClient } from "@/lib/db/tenant-client";
import { decryptPHI } from "@/lib/crypto/phi";
import { getMessagingAdapter } from "@/lib/integrations/messaging";
import { buildCfmValidationUrl } from "./prescription-settings.service";

export async function sendPrescriptionToPatient(
  db: TenantClient,
  organizationId: string,
  prescriptionId: string,
) {
  const rx = await db.prescription.findFirstOrThrow({
    where: { id: prescriptionId, organizationId },
    include: {
      patient: true,
      encounter: { include: { professional: true } },
      items: true,
    },
  });

  if (!rx.validationCode) {
    throw new Error("Receita sem código de validação");
  }

  const validationUrl = rx.validationUrl ?? buildCfmValidationUrl(rx.validationCode);
  const patientName = rx.patient.socialName ?? rx.patient.fullName;

  let phone: string | null = null;
  let email: string | null = null;
  if (rx.patient.phonesEncrypted) {
    try {
      const phones = JSON.parse(decryptPHI(rx.patient.phonesEncrypted)) as Array<{
        number?: string;
      }>;
      phone = phones[0]?.number ?? null;
    } catch {
      phone = null;
    }
  }
  if (rx.patient.emailEncrypted) {
    try {
      email = decryptPHI(rx.patient.emailEncrypted);
    } catch {
      email = null;
    }
  }

  const body = [
    `Olá ${patientName},`,
    "",
    `Sua receita digital está disponível.`,
    `Profissional: ${rx.encounter.professional.displayName}`,
    `Validação CFM: ${validationUrl}`,
    `Código: ${rx.validationCode}`,
    "",
    "Acesse também o portal do paciente para baixar o PDF.",
  ].join("\n");

  const messaging = getMessagingAdapter();

  if (phone) {
    const result = await messaging.send({
      to: phone,
      body,
      channel: "WHATSAPP",
      organizationId,
      metadata: { prescriptionId, validationCode: rx.validationCode },
    });
    if (!result.success) {
      throw new Error(result.error ?? "Falha ao enviar WhatsApp");
    }
  } else if (email) {
    const result = await messaging.send({
      to: email,
      subject: "Receita digital — Vital8",
      body,
      channel: "EMAIL",
      metadata: { prescriptionId },
    });
    if (!result.success) {
      throw new Error(result.error ?? "Falha ao enviar e-mail");
    }
  } else {
    throw new Error("Paciente sem telefone ou e-mail para envio");
  }

  await db.prescription.update({
    where: { id: prescriptionId },
    data: { sentToPatientAt: new Date() },
  });

  return { validationUrl, sentTo: phone ? ("WHATSAPP" as const) : ("EMAIL" as const) };
}
