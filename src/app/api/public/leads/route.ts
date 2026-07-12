import { NextResponse } from "next/server";
import { capturePublicLeadAction } from "@/modules/marketing/actions/public-lead.actions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await capturePublicLeadAction(body);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Erro" },
      { status: 400 },
    );
  }
}
