import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCalendarCode } from "@/lib/integrations/calendar/google-oauth";
import { saveProfessionalCalendarLink } from "@/lib/integrations/calendar/sync.service";

export const dynamic = "force-dynamic";

function parseState(state: string): {
  organizationId: string;
  professionalId: string;
  userId: string;
} | null {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const data = JSON.parse(raw) as {
      organizationId: string;
      professionalId: string;
      userId: string;
      sig: string;
    };
    const secret = process.env.AUTH_SECRET ?? "dev";
    const expected = createHash("sha256")
      .update(`${data.organizationId}:${data.professionalId}:${data.userId}:${secret}`)
      .digest("hex")
      .slice(0, 16);
    if (data.sig !== expected) return null;
    return {
      organizationId: data.organizationId,
      professionalId: data.professionalId,
      userId: data.userId,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const redirectBase =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${redirectBase}/app/configuracoes/integracoes?calendar=error`,
    );
  }

  const parsed = parseState(state);
  if (!parsed) {
    return NextResponse.redirect(
      `${redirectBase}/app/configuracoes/integracoes?calendar=invalid`,
    );
  }

  try {
    const tokens = await exchangeGoogleCalendarCode(code);
    await saveProfessionalCalendarLink({
      organizationId: parsed.organizationId,
      professionalId: parsed.professionalId,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
    });
    return NextResponse.redirect(
      `${redirectBase}/app/configuracoes/integracoes?calendar=connected`,
    );
  } catch {
    return NextResponse.redirect(
      `${redirectBase}/app/configuracoes/integracoes?calendar=error`,
    );
  }
}
