import { isAwsSnsConfigured, isAwsSnsProductionReady } from "./sns-sms.adapter";

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export type MessagingInfraReadiness = {
  resendConfigured: boolean;
  snsConfigured: boolean;
  snsProductionReady: boolean;
  emailFrom: boolean;
  note: string;
};

export function getMessagingInfraReadiness(): MessagingInfraReadiness {
  const resendConfigured = isResendConfigured();
  const snsConfigured = isAwsSnsConfigured();
  const snsProductionReady = isAwsSnsProductionReady();
  const emailFrom = Boolean(process.env.EMAIL_FROM?.trim());

  let note: string;
  if (!resendConfigured && !snsConfigured) {
    note =
      "E-mail e SMS usam adapter console — configure RESEND_API_KEY e/ou AWS SNS.";
  } else if (resendConfigured && snsProductionReady) {
    note = "Resend (e-mail) + AWS SNS (SMS transacional) ativos.";
  } else if (resendConfigured && snsConfigured && !snsProductionReady) {
    note =
      "Resend ativo. SNS em sandbox — defina AWS_SNS_SMS_PRODUCTION=1 após aprovação AWS.";
  } else if (resendConfigured) {
    note = "Resend ativo para e-mail. SMS permanece em console até AWS SNS.";
  } else {
    note = "AWS SNS configurado para SMS. E-mail em console até RESEND_API_KEY.";
  }

  return {
    resendConfigured,
    snsConfigured,
    snsProductionReady,
    emailFrom,
    note,
  };
}
