import { adminPrisma } from "@/lib/db/admin-client";
import { createNotification } from "@/modules/analytics/services/notification.service";

export function shouldInviteGoogleReview(score: number): boolean {
  return score >= 9;
}

export function shouldNeverInviteGoogleReview(score: number): boolean {
  return score <= 6;
}

export async function handleNpsReputation(
  organizationId: string,
  patientId: string,
  score: number,
) {
  if (shouldNeverInviteGoogleReview(score)) {
    return { invited: false, reason: "detractor" as const };
  }
  if (!shouldInviteGoogleReview(score)) {
    return { invited: false, reason: "neutral" as const };
  }

  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org.settings ?? {}) as Record<string, unknown>;
  const googleReviewUrl = settings.googleReviewUrl as string | undefined;
  if (!googleReviewUrl) {
    return { invited: false, reason: "no_url" as const };
  }

  const patient = await adminPrisma.patient.findFirst({
    where: { id: patientId },
    select: { fullName: true },
  });

  await adminPrisma.auditLog.create({
    data: {
      organizationId,
      action: "reputation.google_invite",
      entityType: "Patient",
      entityId: patientId,
      metadata: { score, googleReviewUrl },
    },
  });

  return {
    invited: true,
    googleReviewUrl,
    message: `Olá ${patient?.fullName ?? ""}! Ficamos felizes com sua avaliação. Se puder, deixe um comentário no Google: ${googleReviewUrl}`,
  };
}

export async function requestTestimonial(
  organizationId: string,
  patientId: string,
  authorName: string,
) {
  return adminPrisma.testimonial.create({
    data: {
      organizationId,
      patientId,
      authorName,
      content: "",
      status: "SOLICITADO",
    },
  });
}

export async function submitTestimonialWithConsent(input: {
  testimonialId: string;
  content: string;
  consentIp: string;
}) {
  return adminPrisma.testimonial.update({
    where: { id: input.testimonialId },
    data: {
      content: input.content,
      consentAt: new Date(),
      consentIp: input.consentIp,
      status: "RECEBIDO",
    },
  });
}

export async function approveTestimonial(
  organizationId: string,
  testimonialId: string,
  reviewerUserId: string,
) {
  const t = await adminPrisma.testimonial.update({
    where: { id: testimonialId },
    data: { status: "APROVADO" },
  });
  await createNotification({
    organizationId,
    userId: reviewerUserId,
    type: "SYSTEM",
    title: "Depoimento aprovado",
    body: `${t.authorName} — pronto para publicar`,
    metadata: { testimonialId },
  });
  return t;
}

export async function publishTestimonial(testimonialId: string) {
  return adminPrisma.testimonial.update({
    where: { id: testimonialId },
    data: { status: "PUBLICADO" },
  });
}
