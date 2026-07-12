import { NextResponse } from "next/server";
import { requireAuth, getRequestMeta } from "@/lib/auth/guards";
import { getStorageAdapter } from "@/lib/integrations/storage";
import { createAuditLog } from "@/modules/core/services/audit.service";

type RouteContext = {
  params: { id: string; docId: string };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await requireAuth([
      "OWNER",
      "ADMIN",
      "PROFISSIONAL_SAUDE",
      "RECEPCAO",
      "FINANCEIRO",
    ]);
    const { id: patientId, docId } = context.params;

    const doc = await ctx.db.patientDocument.findFirst({
      where: { id: docId, patientId },
    });

    if (!doc) {
      return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    }

    const storage = getStorageAdapter();
    const buffer = await storage.download(doc.storageKey);

    const meta = await getRequestMeta();
    await createAuditLog({
      action: "patient.document.download",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      entityType: "PatientDocument",
      entityId: doc.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="${doc.fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
}
