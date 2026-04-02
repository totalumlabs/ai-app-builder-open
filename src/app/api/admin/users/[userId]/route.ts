import { getAdminSession } from "@/lib/admin-auth";
import { totalumSdk } from "@/lib/totalum";
import { vcaasRequest } from "@/lib/vcaas";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminCheck = await getAdminSession();
    if (adminCheck.error) return adminCheck.error;

    const { userId } = await params;
    console.log("[Admin UserDetail] Fetching user:", userId);

    // Get user record
    const userResult = await totalumSdk.crud.getRecordById("user", userId);
    const user = userResult.data as Record<string, unknown>;
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    // Get user's projects
    const projResult = await totalumSdk.crud.query("user_project", {
      _filter: { owner_id: userId },
      _sort: { createdAt: "desc" },
      _limit: 100,
    });
    const userProjects = Array.isArray(projResult.data) ? projResult.data : [];

    // Fetch VCaaS details for each project
    let totalCreditsSpent = 0;
    const projects = await Promise.all(
      userProjects.map(async (p: Record<string, unknown>) => {
        try {
          const res = await vcaasRequest(`/projects/${p.project_id}`);
          const json = (await res.json()) as { errors: unknown; data: Record<string, unknown> };
          if (!json.errors && json.data) {
            totalCreditsSpent += Number(json.data.totalCreditsSpent) || 0;
            return { ...p, vcaas: json.data };
          }
        } catch (err) {
          console.log("[Admin UserDetail] Error fetching project:", p.project_id, err);
        }
        return { ...p, vcaas: null };
      })
    );

    // Get last session
    let lastSession: Record<string, unknown> | null = null;
    try {
      const sessionResult = await totalumSdk.crud.query("session", {
        _filter: { user_id: userId },
        _sort: { updatedAt: "desc" },
        _limit: 1,
      });
      const sessions = Array.isArray(sessionResult.data) ? sessionResult.data : [];
      if (sessions.length > 0) {
        lastSession = sessions[0] as Record<string, unknown>;
      }
    } catch {
      // ignore
    }

    console.log("[Admin UserDetail] User:", user.email, "projects:", projects.length, "credits:", totalCreditsSpent);

    return NextResponse.json({
      ok: true,
      data: { user, projects, lastSession, totalCreditsSpent },
    });
  } catch (error) {
    console.error("[Admin UserDetail] Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminCheck = await getAdminSession();
    if (adminCheck.error) return adminCheck.error;

    const { userId } = await params;
    const body = (await req.json()) as { name?: string; email?: string; role?: string };

    console.log("[Admin UserEdit] Editing user:", userId, body);

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.email !== undefined) updates.email = body.email;
    if (body.role !== undefined) updates.role = body.role;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
    }

    const result = await totalumSdk.crud.editRecordById("user", userId, updates);
    console.log("[Admin UserEdit] Updated user:", userId);

    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    console.error("[Admin UserEdit] Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to update user" }, { status: 500 });
  }
}
