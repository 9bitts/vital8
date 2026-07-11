"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@/generated/prisma/client";
import { refreshSessionOrganization } from "@/lib/auth/auth";
import { AuthError, getRequestMeta, requireAuth } from "@/lib/auth/guards";
import { adminPrisma } from "@/lib/db/admin-client";
import {
  deactivateMemberSchema,
  inviteMemberSchema,
  switchOrganizationSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from "@/modules/core/schemas/auth.schema";
import { createAuditLog } from "@/modules/core/services/audit.service";
import type { ActionResult } from "@/lib/auth/guards";

export async function updateOrganizationAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    const parsed = updateOrganizationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    await adminPrisma.organization.update({
      where: { id: ctx.organizationId, deletedAt: null },
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        documentType: parsed.data.documentType,
        documentNumber: parsed.data.documentNumber.replace(/\D/g, ""),
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
      },
    });

    const meta = await getRequestMeta();
    await createAuditLog({
      action: "organization.update",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      entityType: "Organization",
      entityId: ctx.organizationId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    revalidatePath("/app/configuracoes");
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao atualizar organização" };
  }
}

export async function getOrganizationAction() {
  const ctx = await requireAuth();
  const org = await adminPrisma.organization.findFirst({
    where: { id: ctx.organizationId, deletedAt: null },
  });
  return org;
}

export async function listMembersAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  return ctx.db.membership.findMany({
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function inviteMemberAction(
  input: unknown,
): Promise<ActionResult<{ token: string }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    const parsed = inviteMemberSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    if (parsed.data.role === "OWNER") {
      return { success: false, error: "Convites para OWNER não são permitidos" };
    }

    const email = parsed.data.email.toLowerCase();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const token = crypto.randomUUID();

    const invitation = await ctx.db.invitation.create({
      data: {
        organizationId: ctx.organizationId,
        email,
        role: parsed.data.role,
        token,
        expiresAt,
        invitedById: ctx.userId,
      },
    });

    const meta = await getRequestMeta();
    await createAuditLog({
      action: "invitation.create",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      entityType: "Invitation",
      entityId: invitation.id,
      metadata: { email, role: parsed.data.role },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    revalidatePath("/app/configuracoes");
    return { success: true, data: { token: invitation.token } };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao criar convite" };
  }
}

export async function updateMemberRoleAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    const parsed = updateMemberRoleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const membership = await ctx.db.membership.findFirst({
      where: { id: parsed.data.membershipId },
    });

    if (!membership) {
      return { success: false, error: "Membro não encontrado" };
    }

    if (membership.role === "OWNER" && parsed.data.role !== "OWNER") {
      const ownerCount = await ctx.db.membership.count({
        where: { role: "OWNER", isActive: true },
      });
      if (ownerCount <= 1) {
        return { success: false, error: "A organização precisa de ao menos um OWNER" };
      }
    }

    await ctx.db.membership.update({
      where: { id: parsed.data.membershipId },
      data: { role: parsed.data.role },
    });

    const meta = await getRequestMeta();
    await createAuditLog({
      action: "membership.role_update",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      entityType: "Membership",
      entityId: parsed.data.membershipId,
      metadata: { newRole: parsed.data.role },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    revalidatePath("/app/configuracoes");
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao atualizar papel" };
  }
}

export async function deactivateMemberAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    const parsed = deactivateMemberSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const membership = await ctx.db.membership.findFirst({
      where: { id: parsed.data.membershipId },
    });

    if (!membership) {
      return { success: false, error: "Membro não encontrado" };
    }

    if (membership.userId === ctx.userId) {
      return { success: false, error: "Você não pode desativar a si mesmo" };
    }

    if (membership.role === "OWNER") {
      const ownerCount = await ctx.db.membership.count({
        where: { role: "OWNER", isActive: true },
      });
      if (ownerCount <= 1) {
        return { success: false, error: "A organização precisa de ao menos um OWNER" };
      }
    }

    await ctx.db.membership.update({
      where: { id: parsed.data.membershipId },
      data: { isActive: false, deletedAt: new Date() },
    });

    const meta = await getRequestMeta();
    await createAuditLog({
      action: "membership.deactivate",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      entityType: "Membership",
      entityId: parsed.data.membershipId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    revalidatePath("/app/configuracoes");
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao desativar membro" };
  }
}

export async function listUserOrganizationsAction() {
  const ctx = await requireAuth();
  return adminPrisma.membership.findMany({
    where: {
      userId: ctx.userId,
      isActive: true,
      deletedAt: null,
      organization: { isActive: true, deletedAt: null },
    },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, type: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function switchOrganizationAction(
  input: unknown,
): Promise<ActionResult<{ organizationId: string; role: Role }>> {
  try {
    const ctx = await requireAuth();
    const parsed = switchOrganizationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Organização inválida" };
    }

    const refreshed = await refreshSessionOrganization(
      ctx.userId,
      parsed.data.organizationId,
    );

    if (!refreshed) {
      return { success: false, error: "Você não pertence a esta organização" };
    }

    const meta = await getRequestMeta();
    await createAuditLog({
      action: "organization.switch",
      userId: ctx.userId,
      organizationId: refreshed.organizationId,
      metadata: { fromOrganizationId: ctx.organizationId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { success: true, data: refreshed };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao trocar organização" };
  }
}

export async function listAuditLogsAction(page = 1) {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  const { listAuditLogs } = await import(
    "@/modules/core/services/audit.service"
  );
  return listAuditLogs(ctx.organizationId, page, 20);
}

export async function getInvitationByTokenAction(token: string) {
  const invitation = await adminPrisma.invitation.findUnique({
    where: { token },
    include: {
      organization: { select: { id: true, name: true } },
    },
  });

  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return null;
  }

  return invitation;
}

export async function acceptInvitationAction(
  input: unknown,
): Promise<ActionResult> {
  const { acceptInviteSchema } = await import(
    "@/modules/core/schemas/auth.schema"
  );
  const { hashPassword } = await import("@/lib/auth/password");

  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const invitation = await adminPrisma.invitation.findUnique({
    where: { token: parsed.data.token },
  });

  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return { success: false, error: "Convite inválido ou expirado" };
  }

  const email = invitation.email.toLowerCase();
  let user = await adminPrisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  if (!user) {
    if (!parsed.data.name || !parsed.data.password) {
      return {
        success: false,
        error: "Nome e senha são obrigatórios para novos usuários",
      };
    }
    const passwordHash = await hashPassword(parsed.data.password);
    user = await adminPrisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
      },
    });
  }

  const existingMembership = await adminPrisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: invitation.organizationId,
      },
    },
  });

  if (existingMembership && existingMembership.isActive) {
    return { success: false, error: "Você já é membro desta organização" };
  }

  await adminPrisma.$transaction(async (tx) => {
    if (existingMembership) {
      await tx.membership.update({
        where: { id: existingMembership.id },
        data: {
          role: invitation.role,
          isActive: true,
          deletedAt: null,
        },
      });
    } else {
      await tx.membership.create({
        data: {
          userId: user!.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      });
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
  });

  const meta = await getRequestMeta();
  await createAuditLog({
    action: "invitation.accept",
    userId: user.id,
    organizationId: invitation.organizationId,
    entityType: "Invitation",
    entityId: invitation.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { success: true };
}
