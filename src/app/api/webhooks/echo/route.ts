import { NextResponse } from "next/server";

/** Endpoint de eco para testes de webhook (seed Doctor8). */
export async function POST(request: Request) {
  const signature = request.headers.get("x-vital8-signature");
  const event = request.headers.get("x-vital8-event");
  const body = await request.text();
  return NextResponse.json({
    received: true,
    event,
    signaturePresent: Boolean(signature),
    bodyLength: body.length,
  });
}
