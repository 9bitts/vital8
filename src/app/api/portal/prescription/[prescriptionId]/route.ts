import { NextResponse } from "next/server";
import { adminPrisma } from "@/lib/db/admin-client";
import { getStorageAdapter } from "@/lib/integrations/storage";
import { getPortalSessionFromCookie } from "@/modules/engagement/lib/portal-session";

type Params = { params: { prescriptionId: string } };

export async function GET(_request: Request, { params }: Params) {
  const session = await getPortalSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const released = await adminPrisma.releasedDocument.findFirst({
    where: {
      prescriptionId: params.prescriptionId,
      organizationId: session.organizationId,
      patientId: session.patientId,
      documentType: "PRESCRIPTION",
      revokedAt: null,
    },
  });

  if (!released) {
    return NextResponse.json({ error: "Receita não liberada" }, { status: 404 });
  }

  const signed = await adminPrisma.signedClinicalDocument.findFirst({
    where: {
      organizationId: session.organizationId,
      entityType: "PRESCRIPTION",
      entityId: params.prescriptionId,
    },
  });

  if (!signed?.pdfStorageKey) {
    return NextResponse.json({ error: "PDF não disponível" }, { status: 404 });
  }

  const buffer = await getStorageAdapter().download(signed.pdfStorageKey);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receita-${params.prescriptionId}.pdf"`,
    },
  });
}
