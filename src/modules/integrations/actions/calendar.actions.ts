"use server";

import { createHash } from "crypto";
import { requireAuth } from "@/lib/auth/guards";
import { adminPrisma } from "@/lib/db/admin-client";
import { buildGoogleCalendarAuthUrl } from "@/lib/integrations/calendar";
import { isGoogleCalendarConfigured } from "@/lib/integrations/calendar/google-config";

export async function startGoogleCalendarConnectAction(professionalId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"]);
  if (!isGoogleCalendarConfigured()) {
    throw new Error("Google Calendar não configurado na plataforma");
  }

  const professional = await adminPrisma.professional.findFirst({
    where: { id: professionalId, organizationId: ctx.organizationId },
  });
  if (!professional) throw new Error("Profissional não encontrado");

  const sig = createHash("sha256")
    .update(
      `${ctx.organizationId}:${professionalId}:${ctx.userId}:${process.env.AUTH_SECRET ?? "dev"}`,
    )
    .digest("hex")
    .slice(0, 16);

  const state = Buffer.from(
    JSON.stringify({
      organizationId: ctx.organizationId,
      professionalId,
      userId: ctx.userId,
      sig,
    }),
  ).toString("base64url");

  return { url: buildGoogleCalendarAuthUrl(state) };
}

export async function disconnectGoogleCalendarAction(professionalId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"]);

  const professional = await adminPrisma.professional.findFirst({
    where: { id: professionalId, organizationId: ctx.organizationId },
  });
  if (!professional) throw new Error("Profissional não encontrado");

  await adminPrisma.professionalCalendarLink.deleteMany({
    where: {
      professionalId,
      organizationId: ctx.organizationId,
    },
  });

  return { ok: true };
}

export async function listGoogleCalendarLinksAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"]);

  const links = await adminPrisma.professionalCalendarLink.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      professional: { select: { id: true, displayName: true, userId: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return links.map((l) => ({
    professionalId: l.professionalId,
    professionalName: l.professional.displayName,
    syncEnabled: l.syncEnabled,
    lastSyncAt: l.lastSyncAt?.toISOString() ?? null,
    isCurrentUser: l.professional.userId === ctx.userId,
  }));
}
