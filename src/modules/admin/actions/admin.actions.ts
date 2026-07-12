"use server";

import type { Prisma, SubscriptionCycle, SubscriptionPlan } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import {
  AuthError,
  requireAuth,
  type ActionResult,
  mapAuthError,
} from "@/lib/auth/guards";
import type { PermissionKey } from "@/lib/auth/permissions";
import { adminPrisma } from "@/lib/db/admin-client";
import { createBranch, listAccessibleBranches } from "../services/branch.service";
import { canUser, seedDefaultProfiles } from "../services/permission-profile.service";
import {
  changePlan,
  ensureSubscription,
  getSubscriptionUsage,
} from "../services/subscription.service";
import { getBillingAdapter } from "@/lib/integrations/billing";
import { createAuditLog } from "@/modules/core/services/audit.service";

export async function listBranchesAction() {
  const ctx = await requireAuth();
  const membership = await adminPrisma.membership.findFirstOrThrow({
    where: { userId: ctx.userId, organizationId: ctx.organizationId, isActive: true },
  });
  return listAccessibleBranches(
    ctx.organizationId,
    membership.id,
    membership.branchAccessAll,
  );
}

export async function switchBranchAction(branchId: string | null) {
  const ctx = await requireAuth();
  if (branchId) {
    const membership = await adminPrisma.membership.findFirstOrThrow({
      where: { userId: ctx.userId, organizationId: ctx.organizationId, isActive: true },
    });
    const branches = await listAccessibleBranches(
      ctx.organizationId,
      membership.id,
      membership.branchAccessAll,
    );
    if (!branches.some((b) => b.id === branchId)) {
      throw new AuthError("Unidade não autorizada", "FORBIDDEN");
    }
  }
  return { branchId };
}

export async function createBranchAction(input: {
  name: string;
  cnes?: string;
  documentNumber?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    const allowed = await canUser(ctx.organizationId, ctx.userId, ctx.role, "configuracoes.edit");
    if (!allowed) throw new AuthError("Sem permissão", "FORBIDDEN");
    const branch = await createBranch({ organizationId: ctx.organizationId, ...input });
    revalidatePath("/app/configuracoes");
    return { success: true, data: { id: branch.id } };
  } catch (e) {
    return mapAuthError(e) as ActionResult<{ id: string }>;
  }
}

export async function listPermissionProfilesAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  return adminPrisma.permissionProfile.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { name: "asc" },
  });
}

export async function savePermissionProfileAction(input: {
  id?: string;
  name: string;
  permissions: Record<string, unknown>;
  limits: Record<string, unknown>;
}): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    if (input.id) {
      await adminPrisma.permissionProfile.update({
        where: { id: input.id, organizationId: ctx.organizationId },
        data: {
          name: input.name,
          permissions: input.permissions as Prisma.InputJsonValue,
          limits: input.limits as Prisma.InputJsonValue,
        },
      });
    } else {
      await adminPrisma.permissionProfile.create({
        data: {
          organizationId: ctx.organizationId,
          name: input.name,
          permissions: input.permissions as Prisma.InputJsonValue,
          limits: input.limits as Prisma.InputJsonValue,
        },
      });
    }
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "permission.profile.update",
      entityType: "PermissionProfile",
      entityId: input.id ?? "new",
      metadata: { name: input.name },
    });
    revalidatePath("/app/configuracoes/permissoes");
    return { success: true, data: undefined };
  } catch (e) {
    return mapAuthError(e);
  }
}

export async function getSubscriptionAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  await ensureSubscription(ctx.organizationId);
  return getSubscriptionUsage(ctx.organizationId);
}

export async function startCheckoutAction(
  plan: SubscriptionPlan,
  cycle: SubscriptionCycle,
): Promise<ActionResult<{ checkoutUrl: string }>> {
  try {
    const ctx = await requireAuth(["OWNER"]);
    const adapter = getBillingAdapter();
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const result = await adapter.createCheckout({
      organizationId: ctx.organizationId,
      plan,
      cycle,
      successUrl: `${base}/app/assinatura?success=1`,
      cancelUrl: `${base}/app/assinatura`,
    });
    return { success: true, data: { checkoutUrl: result.checkoutUrl } };
  } catch (e) {
    return mapAuthError(e) as ActionResult<{ checkoutUrl: string }>;
  }
}

export async function completeMockCheckoutAction(
  plan: SubscriptionPlan,
  cycle: SubscriptionCycle,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER"]);
    await changePlan(ctx.organizationId, plan, cycle);
    revalidatePath("/app/assinatura");
    return { success: true, data: undefined };
  } catch (e) {
    return mapAuthError(e);
  }
}

export async function checkPermissionAction(key: PermissionKey) {
  const ctx = await requireAuth();
  return canUser(ctx.organizationId, ctx.userId, ctx.role, key);
}

export async function initAdminDefaultsAction(organizationId: string) {
  await seedDefaultProfiles(organizationId);
}
