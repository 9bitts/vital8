import { createHash } from "crypto";
import { adminPrisma } from "@/lib/db/admin-client";
import { normalizePhone } from "@/lib/crypto/search-hash";
import { getMessagingAdapter } from "@/lib/integrations/messaging";
import {
  createPortalSession,
  generateOtp,
  hashToken,
  setPortalSessionCookie,
  verifyOtpHash,
} from "../lib/portal-session";
import { checkRateLimit } from "../lib/rate-limit";

const OTP_TTL_MS = 10 * 60 * 1000;

function contactHash(organizationId: string, contact: string): string {
  return createHash("sha256")
    .update(`${organizationId}:${normalizePhone(contact)}`)
    .digest("hex");
}

export async function requestPortalOtp(input: {
  organizationId: string;
  phone: string;
  purpose: "BOOKING" | "PORTAL_LOGIN";
  ipKey: string;
}) {
  const ipLimit = checkRateLimit(`otp:ip:${input.ipKey}`, 10, 60 * 60 * 1000);
  if (!ipLimit.allowed) {
    throw new Error("Muitas tentativas. Aguarde e tente novamente.");
  }
  const phoneLimit = checkRateLimit(
    `otp:phone:${input.organizationId}:${normalizePhone(input.phone)}`,
    5,
    60 * 60 * 1000,
  );
  if (!phoneLimit.allowed) {
    throw new Error("Limite de OTP por telefone excedido.");
  }

  const digits = normalizePhone(input.phone);
  const patient = await adminPrisma.patient.findFirst({
    where: { organizationId: input.organizationId, phoneSearch: digits },
  });

  const otp = generateOtp();
  await adminPrisma.patientPortalOtp.create({
    data: {
      organizationId: input.organizationId,
      patientId: patient?.id ?? null,
      contactHash: contactHash(input.organizationId, input.phone),
      contactType: "phone",
      otpHash: hashToken(otp),
      purpose: input.purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const messaging = getMessagingAdapter();
  await messaging.send({
    channel: "SMS",
    to: digits,
    body: `Seu código Vital8: ${otp}. Válido por 10 minutos.`,
    organizationId: input.organizationId,
  });

  return { patientFound: Boolean(patient), patientId: patient?.id ?? null };
}

export async function verifyPortalOtp(input: {
  organizationId: string;
  phone: string;
  otp: string;
  purpose: "BOOKING" | "PORTAL_LOGIN";
  fullName?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const hash = contactHash(input.organizationId, input.phone);
  const record = await adminPrisma.patientPortalOtp.findFirst({
    where: {
      organizationId: input.organizationId,
      contactHash: hash,
      purpose: input.purpose,
      verifiedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!record) throw new Error("Código inválido ou expirado.");
  if (record.attempts >= record.maxAttempts) {
    throw new Error("Tentativas excedidas.");
  }

  if (!verifyOtpHash(input.otp, record.otpHash)) {
    await adminPrisma.patientPortalOtp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new Error("Código incorreto.");
  }

  await adminPrisma.patientPortalOtp.update({
    where: { id: record.id },
    data: { verifiedAt: new Date() },
  });

  let patientId = record.patientId;
  if (!patientId) {
    const digits = normalizePhone(input.phone);
    const name = input.fullName?.trim() || "Paciente online";
    const patient = await adminPrisma.patient.create({
      data: {
        organizationId: input.organizationId,
        searchName: name.toLowerCase(),
        fullName: name,
        phoneSearch: digits,
        isIncomplete: true,
      },
    });
    patientId = patient.id;
  }

  const token = await createPortalSession(input.organizationId, patientId, {
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  await setPortalSessionCookie(token);

  return { patientId, sessionToken: token };
}
