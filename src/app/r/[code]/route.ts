import { NextResponse } from "next/server";
import { recordTrackedClick } from "@/modules/marketing/services/tracking.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const link = await recordTrackedClick(code);
  if (!link) {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }
  return NextResponse.redirect(link.targetUrl);
}
