import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Stub "forgot password" handler — always returns a redirect marker. */
export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
