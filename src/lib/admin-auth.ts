import "server-only";
import { auth } from "@/lib/auth";
import { totalumSdk } from "@/lib/totalum";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

interface AdminSessionResult {
  session?: ReturnType<typeof auth.api.getSession> extends Promise<infer T> ? T : never;
  user?: Record<string, unknown>;
  error?: NextResponse;
}

export async function getAdminSession(): Promise<AdminSessionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    console.log("[Admin] No session found");
    return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  try {
    const userResult = await totalumSdk.crud.getRecordById("user", session.user.id);
    const user = userResult.data as Record<string, unknown>;
    if (!user || user.role !== "admin") {
      console.log("[Admin] User is not admin:", session.user.id, "role:", user?.role);
      return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
    }
    console.log("[Admin] Admin access granted for:", session.user.email);
    return { session, user };
  } catch (err) {
    console.error("[Admin] Error checking admin role:", err);
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }
}
