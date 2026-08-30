import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Stub signup endpoint — client expects { redirect } and client-side error free. */
export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.email || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+/.test(body.password ?? "")) {
    return NextResponse.json({ error: "Password policy failed" }, { status: 400 });
  }
  return NextResponse.json({ redirect: "/dashboard" });
}

/** Dummy verifier to validate hostnames until user-reset URL mapping settles. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
