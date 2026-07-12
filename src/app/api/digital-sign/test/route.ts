import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createSignatureSession } from "@/lib/integrations/digital-signature/lacuna-client";
import {
  LACUNA_ERROR_MESSAGES,
  parseLacunaError,
} from "@/lib/integrations/digital-signature/lacuna-errors";
import { buildDigitalSignTestPdf } from "@/lib/integrations/digital-signature/lacuna-test-pdf";
import { isLacunaConfigured } from "@/lib/integrations/digital-signature/lacuna-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    if (!isLacunaConfigured()) {
      return NextResponse.json(
        { error: "LACUNA_API_KEY não configurada" },
        { status: 400 },
      );
    }

    const pdf = await buildDigitalSignTestPdf({
      doctorName: ctx.userName,
      cpfMasked: "***.***.***-**",
    });

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await createSignatureSession({
      pdfBytes: Buffer.from(pdf),
      fileName: "vital8-teste-assinatura.pdf",
      returnUrl: `${base.replace(/\/+$/, "")}/api/digital-sign/callback`,
      cpf: null,
    });

    return NextResponse.json({ redirectUrl: session.redirectUrl });
  } catch (e) {
    const code = parseLacunaError(e);
    return NextResponse.json(
      { error: LACUNA_ERROR_MESSAGES[code] },
      { status: 502 },
    );
  }
}
