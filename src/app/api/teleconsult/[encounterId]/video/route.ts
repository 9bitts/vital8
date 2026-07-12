import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { adminPrisma } from "@/lib/db/admin-client";
import {
  createTeleconsultRoom,
  getTeleconsultVideoCredentials,
} from "@/modules/engagement/services/teleconsult.service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { encounterId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const encounter = await adminPrisma.encounter.findFirst({
    where: { id: params.encounterId },
    include: {
      professional: { select: { userId: true, displayName: true } },
      patient: { select: { fullName: true, socialName: true } },
      teleconsultRoom: true,
      appointment: { include: { service: { select: { isTeleconsult: true } } } },
    },
  });

  if (!encounter) {
    return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
  }

  const membership = await adminPrisma.membership.findFirst({
    where: {
      organizationId: encounter.organizationId,
      userId: session.user.id,
      isActive: true,
    },
    select: { role: true },
  });

  const isProfessional =
    encounter.professional.userId === session.user.id ||
    Boolean(membership);

  if (!isProfessional) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isTeleconsult =
    encounter.modality === "TELECONSULTA" ||
    encounter.appointment?.service.isTeleconsult;

  if (!isTeleconsult) {
    return NextResponse.json(
      { error: "Este atendimento não é teleconsulta" },
      { status: 400 },
    );
  }

  if (!encounter.teleconsultRoom) {
    try {
      await createTeleconsultRoom(encounter.organizationId, encounter.id);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Falha ao criar sala de vídeo";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  try {
    const credentials = await getTeleconsultVideoCredentials(
      encounter.organizationId,
      encounter.id,
      "professional",
      encounter.professional.displayName,
    );
    return NextResponse.json(credentials);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Serviço de vídeo indisponível";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
