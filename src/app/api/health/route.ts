import { NextResponse } from "next/server";
import { adminPrisma } from "@/lib/db/admin-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await adminPrisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      version: process.env.npm_package_version ?? "0.1.0",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
