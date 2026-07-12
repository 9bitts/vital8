import { NextRequest, NextResponse } from "next/server";
import {
  completeLacunaClinicalSign,
  defaultReturnPath,
} from "@/lib/integrations/digital-signature/lacuna-signature.service";
import { adminPrisma } from "@/lib/db/admin-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function publicBase(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (req.headers.get("x-forwarded-host")
      ? `https://${req.headers.get("x-forwarded-host")}`
      : req.nextUrl.origin)
  ).replace(/\/+$/, "");
}

export async function GET(req: NextRequest) {
  const signatureSessionId =
    req.nextUrl.searchParams.get("signatureSessionId") || "";

  if (!signatureSessionId) {
    return NextResponse.redirect(
      new URL("/app/configuracoes/prontuario?sign=error", publicBase(req)),
    );
  }

  const result = await completeLacunaClinicalSign(signatureSessionId);

  const pending = await adminPrisma.lacunaSignatureSession.findFirst({
    where: { lacunaSessionId: signatureSessionId },
  });

  const returnPath =
    result.returnPath ??
    (pending
      ? defaultReturnPath(pending.entityType, pending.entityId)
      : "/app/configuracoes/prontuario");

  const url = new URL(`${publicBase(req)}${returnPath}`);
  url.searchParams.set("sign", result.status);

  return NextResponse.redirect(url);
}
