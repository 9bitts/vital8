import { NextResponse } from "next/server";
import { requireAuth, getRequestMeta } from "@/lib/auth/guards";
import { isFinanceBlocked } from "@/modules/emr/lib/permissions";
import { getExamResultFile } from "@/modules/emr/services/exam-result.service";

type RouteContext = { params: { resultId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await requireAuth([
      "OWNER",
      "ADMIN",
      "PROFISSIONAL_SAUDE",
    ]);
    if (isFinanceBlocked(ctx.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const meta = await getRequestMeta();
    const file = await getExamResultFile(
      ctx.db,
      ctx.organizationId,
      context.params.resultId,
      ctx.userId,
      meta,
    );

    const inline =
      file.mimeType.startsWith("image/") || file.mimeType === "application/pdf";

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": inline
          ? `inline; filename="${file.fileName}"`
          : `attachment; filename="${file.fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
}
