import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { adminPrisma } from "@/lib/db/admin-client";

export const PORTAL_SESSION_COOKIE = "vital8-portal-session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function verifyOtpHash(otp: string, hash: string): boolean {
  const candidate = hashToken(otp);
  try {
    return timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
  } catch {
    return false;
  }
}

export async function createPortalSession(
  organizationId: string,
  patientId: string,
  meta?: { ipAddress?: string; userAgent?: string },
): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await adminPrisma.patientPortalSession.create({
    data: {
      organizationId,
      patientId,
      sessionTokenHash: hashToken(token),
      expiresAt,
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
    },
  });
  return token;
}

export type PortalSessionContext = {
  organizationId: string;
  patientId: string;
  sessionId: string;
};

export async function getPortalSessionFromCookie(): Promise<PortalSessionContext | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PORTAL_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const session = await adminPrisma.patientPortalSession.findFirst({
    where: {
      sessionTokenHash: hashToken(raw),
      expiresAt: { gt: new Date() },
    },
  });
  if (!session) return null;
  return {
    organizationId: session.organizationId,
    patientId: session.patientId,
    sessionId: session.id,
  };
}

export async function setPortalSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearPortalSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PORTAL_SESSION_COOKIE);
}

export async function destroyPortalSession(token?: string): Promise<void> {
  if (!token) {
    await clearPortalSessionCookie();
    return;
  }
  await adminPrisma.patientPortalSession.deleteMany({
    where: { sessionTokenHash: hashToken(token) },
  });
  await clearPortalSessionCookie();
}
