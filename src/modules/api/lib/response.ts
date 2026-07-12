import { NextResponse } from "next/server";
import { ApiError } from "./errors";

export type ApiMeta = {
  cursor?: string | null;
  hasMore?: boolean;
  limit?: number;
};

export function apiSuccess<T>(data: T, meta?: ApiMeta, status = 200) {
  return NextResponse.json({ data, meta: meta ?? {} }, { status });
}

export function apiErrorResponse(err: unknown, headers?: Record<string, string>) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      { status: err.status, headers },
    );
  }
  console.error("[API]", err);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Erro interno",
        details: [],
      },
    },
    { status: 500, headers },
  );
}

export function parseLimit(raw: string | null, max = 100): number {
  const n = Number(raw ?? 20);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(Math.floor(n), max);
}

export function encodeCursor(id: string, updatedAt: Date): string {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`).toString("base64url");
}

export function decodeCursor(cursor: string): { updatedAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!iso || !id) return null;
    return { updatedAt: new Date(iso), id };
  } catch {
    return null;
  }
}
