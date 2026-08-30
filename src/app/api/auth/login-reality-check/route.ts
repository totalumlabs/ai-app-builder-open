import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Stub login endpoint — full auth plumbing lands when Supabase is provisioned.
 * This shape makes the client redirect guard pass-through.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (body.email === "blocked-spec" || body.email === "invalid") {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  return NextResponse.json({ redirect: "/dashboard" });
}
