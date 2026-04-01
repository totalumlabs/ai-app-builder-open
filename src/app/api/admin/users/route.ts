import { getAdminSession } from "@/lib/admin-auth";
import { totalumSdk } from "@/lib/totalum";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await getAdminSession();
    if (adminCheck.error) return adminCheck.error;

    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const sort = url.searchParams.get("sort") || "createdAt";
    const order = url.searchParams.get("order") || "desc";

    console.log("[Admin Users] Listing users - search:", search, "limit:", limit, "offset:", offset);

    // Build query filter
    const filter: Record<string, unknown> = {};
    if (search) {
      filter._or = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const usersResult = await totalumSdk.crud.query("user", {
      _filter: Object.keys(filter).length > 0 ? filter : undefined,
      _sort: { [sort]: order as "asc" | "desc" },
      _limit: limit,
      _offset: offset,
      _count: true,
    });

    const rawData = usersResult.data;
    const users = Array.isArray(rawData) ? rawData : [];
    const total = (rawData as unknown as { _count?: { _total?: number } })?._count?._total ?? users.length;

    // Enrich each user with project count and last activity
    const enrichedUsers = await Promise.all(
      users.map(async (user: Record<string, unknown>) => {
        const userId = user._id as string;

        // Project count
        let projectCount = 0;
        try {
          const projResult = await totalumSdk.crud.query("user_project", {
            _filter: { owner_id: userId },
            _limit: 100,
          });
          projectCount = Array.isArray(projResult.data) ? projResult.data.length : 0;
        } catch {
          // ignore
        }

        // Last activity from session table
        let lastActivity: string | null = null;
        try {
          const sessionResult = await totalumSdk.crud.query("session", {
            _filter: { user_id: userId },
            _sort: { updatedAt: "desc" },
            _limit: 1,
          });
          const sessions = Array.isArray(sessionResult.data) ? sessionResult.data : [];
          if (sessions.length > 0) {
            lastActivity = (sessions[0] as Record<string, unknown>).updatedAt as string || null;
          }
        } catch {
          // ignore
        }

        return { ...user, projectCount, lastActivity };
      })
    );

    console.log("[Admin Users] Found", enrichedUsers.length, "users, total:", total);

    return NextResponse.json({ ok: true, data: enrichedUsers, total });
  } catch (error) {
    console.error("[Admin Users] Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to list users" }, { status: 500 });
  }
}
