import { auth } from "@/lib/auth";
import { totalumSdk } from "@/lib/totalum";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// GET: List user's projects
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    console.log("[UserProjects] Listing projects for user:", userId);

    const result = await totalumSdk.crud.query("user_project", {
      _filter: { owner_id: userId },
      _sort: { createdAt: "desc" },
      _limit: 100,
    });

    const projects = result.data || [];
    console.log("[UserProjects] Found", Array.isArray(projects) ? projects.length : 0, "projects");
    return NextResponse.json({ ok: true, data: projects });
  } catch (error) {
    console.error("[UserProjects] GET error:", error);
    return NextResponse.json({ ok: false, error: "Failed to list projects" }, { status: 500 });
  }
}

// POST: Create user-project association
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const body = (await req.json()) as { project_id: string; description?: string };

    console.log("[UserProjects] Creating association:", userId, body.project_id);

    const result = await totalumSdk.crud.createRecord("user_project", {
      owner_id: userId,
      project_id: body.project_id,
      description: body.description || "",
    });

    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    console.error("[UserProjects] POST error:", error);
    return NextResponse.json({ ok: false, error: "Failed to create association" }, { status: 500 });
  }
}
