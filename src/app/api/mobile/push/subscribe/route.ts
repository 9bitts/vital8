import { NextResponse } from "next/server";
import { adminPrisma } from "@/lib/db/admin-client";
import { requireMobileSession } from "@/modules/mobile/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireMobileSession();
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: { message: "Subscription inválida" } },
        { status: 400 },
      );
    }

    await adminPrisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        organizationId: session.organizationId,
        userId: session.userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: { message: "Erro interno" } }, { status: 500 });
  }
}
