import { NextResponse } from "next/server";
import {
  buildAgendaSnapshot,
  listAppointmentDelta,
} from "@/modules/mobile/services/sync.service";
import { requireMobileSession } from "@/modules/mobile/lib/mobile-auth";

export const dynamic = "force-dynamic";

async function resolveProfessionalId(
  db: Awaited<ReturnType<typeof requireMobileSession>>["db"],
  userId: string,
  role: string,
) {
  if (role !== "PROFISSIONAL_SAUDE") return null;
  const prof = await db.professional.findFirst({
    where: { userId, isActive: true },
    select: { id: true },
  });
  return prof?.id ?? null;
}

export async function GET(request: Request) {
  try {
    const session = await requireMobileSession();
    const url = new URL(request.url);
    const updatedAfter = url.searchParams.get("updatedAfter");
    const professionalId = await resolveProfessionalId(
      session.db,
      session.userId,
      session.role,
    );

    if (updatedAfter) {
      const delta = await listAppointmentDelta(
        session.db,
        new Date(updatedAfter),
        professionalId,
      );
      return NextResponse.json({ data: { delta, syncedAt: new Date().toISOString() } });
    }

    const snapshot = await buildAgendaSnapshot(
      session.db,
      session.organizationId,
      professionalId,
    );
    return NextResponse.json({ data: snapshot });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: { message: "Erro interno" } }, { status: 500 });
  }
}
