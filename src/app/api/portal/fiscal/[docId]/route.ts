import { NextResponse } from "next/server";
import { adminPrisma } from "@/lib/db/admin-client";
import { getStorageAdapter } from "@/lib/integrations/storage";
import { getPortalSessionFromCookie } from "@/modules/engagement/lib/portal-session";

type Params = { params: { docId: string } };

export async function GET(_request: Request, { params }: Params) {
  const session = await getPortalSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const doc = await adminPrisma.fiscalDocument.findFirst({
    where: {
      id: params.docId,
      organizationId: session.organizationId,
      patientId: session.patientId,
      status: "ISSUED",
      pdfStorageKey: { not: null },
    },
  });

  if (!doc?.pdfStorageKey) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  const buffer = await getStorageAdapter().download(doc.pdfStorageKey);
  const filename =
    doc.documentType === "NFSE"
      ? `nfse-${doc.number ?? doc.id}.pdf`
      : `recibo-${doc.number ?? doc.id}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
