"use server";

import { signIn, signOut } from "@/lib/auth/auth";
import { hashPassword } from "@/lib/auth/password";
import { getRequestMeta, requireAuth } from "@/lib/auth/guards";
import type { ActionResult } from "@/lib/auth/guards";
import { adminPrisma } from "@/lib/db/admin-client";
import { checkLoginRateLimit } from "@/lib/security/login-rate-limit";
import { slugify } from "@/lib/utils";
import {
  loginSchema,
  signupOrganizationSchema,
  signupUserSchema,
} from "@/modules/core/schemas/auth.schema";
import { createAuditLog } from "@/modules/core/services/audit.service";

async function uniqueSlug(base: string): Promise<string> {
  const slug = slugify(base);
  let suffix = 0;

  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const existing = await adminPrisma.organization.findUnique({
      where: { slug: candidate },
    });
    if (!existing) return candidate;
    suffix += 1;
  }
}

export async function signupAction(
  userInput: unknown,
  orgInput: unknown,
): Promise<ActionResult<{ email: string }>> {
  const userParsed = signupUserSchema.safeParse(userInput);
  if (!userParsed.success) {
    return { success: false, error: userParsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const orgParsed = signupOrganizationSchema.safeParse(orgInput);
  if (!orgParsed.success) {
    return { success: false, error: orgParsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { name, email, password } = userParsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await adminPrisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return { success: false, error: "E-mail já cadastrado" };
  }

  const passwordHash = await hashPassword(password);
  const slug = await uniqueSlug(orgParsed.data.name);
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const requestMeta = await getRequestMeta();

  const result = await adminPrisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
      },
    });

    const organization = await tx.organization.create({
      data: {
        name: orgParsed.data.name,
        slug,
        type: orgParsed.data.type,
        documentType: orgParsed.data.documentType,
        documentNumber: orgParsed.data.documentNumber.replace(/\D/g, ""),
        phone: orgParsed.data.phone || null,
        email: orgParsed.data.email || normalizedEmail,
        trialEndsAt,
      },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: "OWNER",
      },
    });

    return { user, organization };
  });

  await createAuditLog({
    action: "user.signup",
    userId: result.user.id,
    organizationId: result.organization.id,
    entityType: "Organization",
    entityId: result.organization.id,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return { success: true, data: { email: normalizedEmail } };
}

export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const meta = await getRequestMeta();
  const limit = checkLoginRateLimit(
    parsed.data.email,
    meta.ipAddress ?? "unknown",
  );
  if (!limit.allowed) {
    return { success: false, error: "Muitas tentativas. Aguarde e tente novamente." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirect: false,
    });
    return { success: true };
  } catch {
    return { success: false, error: "E-mail ou senha incorretos" };
  }
}

export async function logoutAction(): Promise<void> {
  const session = await requireAuth().catch(() => null);
  const meta = await getRequestMeta();

  if (session) {
    await createAuditLog({
      action: "user.logout",
      userId: session.userId,
      organizationId: session.organizationId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  await signOut({ redirectTo: "/" });
}

export async function postLoginSignIn(email: string, password: string) {
  return signIn("credentials", {
    email,
    password,
    redirectTo: "/app",
  });
}
