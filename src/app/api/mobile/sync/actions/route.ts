import { NextResponse } from "next/server";
import {
  applyOfflineAction,
  checkMobileIdempotency,
  logMobileSync,
  storeMobileIdempotency,
  SyncConflictError,
} from "@/modules/mobile/services/sync.service";
import { canUseOffline, requireMobileSession } from "@/modules/mobile/lib/mobile-auth";
import type { OfflineActionType } from "@/lib/offline/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const session = await requireMobileSession();
    if (!canUseOffline(session.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Offline apenas para profissional e recepção" } },
        { status: 403 },
      );
    }

    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Idempotency-Key obrigatório" } },
        { status: 400 },
      );
    }

    const cached = await checkMobileIdempotency(session.userId, idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.statusCode });
    }

    const body = await request.json();
    const type = body.type as OfflineActionType;

    const result = await applyOfflineAction(session.db, session.organizationId, session.userId, {
      type,
      payload: body.payload ?? {},
      expectedUpdatedAt: body.expectedUpdatedAt,
    });

    const response = { data: result };
    await storeMobileIdempotency({
      organizationId: session.organizationId,
      userId: session.userId,
      idempotencyKey,
      actionType: type,
      statusCode: 200,
      responseBody: response,
    });

    await logMobileSync({
      organizationId: session.organizationId,
      userId: session.userId,
      durationMs: Date.now() - start,
      actionsApplied: 1,
      actionsRejected: 0,
      actionsPending: 0,
      metadata: { type, actionId: body.actionId },
    });

    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof SyncConflictError) {
      const response = {
        error: { code: err.code, message: err.message },
      };
      const session = await requireMobileSession().catch(() => null);
      if (session) {
        const key = request.headers.get("idempotency-key");
        if (key) {
          await storeMobileIdempotency({
            organizationId: session.organizationId,
            userId: session.userId,
            idempotencyKey: key,
            actionType: "CONFLICT",
            statusCode: 409,
            responseBody: response,
          });
        }
        await logMobileSync({
          organizationId: session.organizationId,
          userId: session.userId,
          durationMs: Date.now() - start,
          actionsApplied: 0,
          actionsRejected: 1,
          actionsPending: 0,
        });
      }
      return NextResponse.json(response, { status: 409 });
    }
    if (err instanceof Response) return err;
    return NextResponse.json({ error: { message: "Erro interno" } }, { status: 500 });
  }
}
