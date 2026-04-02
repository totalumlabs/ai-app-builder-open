import { getAdminSession } from "@/lib/admin-auth";
import { totalumSdk } from "@/lib/totalum";
import { vcaasRequest } from "@/lib/vcaas";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await getAdminSession();
    if (adminCheck.error) return adminCheck.error;

    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    console.log("[Admin Projects] Listing projects - search:", search, "limit:", limit, "offset:", offset);

    // Build query filter
    const filter: Record<string, unknown> = {};
    if (search) {
      filter.project_id = { contains: search };
    }

    const projectsResult = await totalumSdk.crud.query("user_project", {
      _filter: Object.keys(filter).length > 0 ? filter : undefined,
      _sort: { createdAt: "desc" },
      _limit: limit,
      _offset: offset,
      _count: true,
    });

    const rawData = projectsResult.data;
    const projectRecords = Array.isArray(rawData) ? rawData : [];
    const total = (rawData as unknown as { _count?: { _total?: number } })?._count?._total ?? projectRecords.length;

    // Enrich each project with user info and VCaaS details
    const enrichedProjects = await Promise.all(
      projectRecords.map(async (p: Record<string, unknown>) => {
        // Fetch owner user
        let ownerUser: Record<string, unknown> | null = null;
        try {
          const ownerId = p.owner_id as string;
          if (ownerId) {
            const userResult = await totalumSdk.crud.getRecordById("user", ownerId);
            ownerUser = userResult.data as Record<string, unknown>;
          }
        } catch {
          // ignore - user may have been deleted
        }

        // Fetch VCaaS project details
        let vcaasDetails: Record<string, unknown> | null = null;
        try {
          const res = await vcaasRequest(`/projects/${p.project_id}`);
          const json = (await res.json()) as { errors: unknown; data: Record<string, unknown> };
          if (!json.errors && json.data) {
            vcaasDetails = json.data;
          }
        } catch (err) {
          console.log("[Admin Projects] Error fetching VCaaS details for:", p.project_id, err);
        }

        return { ...p, ownerUser, vcaas: vcaasDetails };
      })
    );

    console.log("[Admin Projects] Found", enrichedProjects.length, "projects, total:", total);

    return NextResponse.json({ ok: true, data: enrichedProjects, total });
  } catch (error) {
    console.error("[Admin Projects] Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to list projects" }, { status: 500 });
  }
}
