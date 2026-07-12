import { NextResponse } from "next/server";
import { requireMobileSession } from "@/modules/mobile/lib/mobile-auth";
import { deriveCacheKeyMaterial } from "@/modules/mobile/services/sync.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireMobileSession();
    const keyMaterial = deriveCacheKeyMaterial(session.userId, session.organizationId);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8);
    return NextResponse.json({
      data: { keyMaterial, expiresAt: expiresAt.toISOString() },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: { message: "Erro interno" } }, { status: 500 });
  }
}
