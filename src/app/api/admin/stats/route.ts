import { getAdminSession } from "@/lib/admin-auth";
import { totalumSdk } from "@/lib/totalum";
import { vcaasRequest } from "@/lib/vcaas";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const adminCheck = await getAdminSession();
    if (adminCheck.error) return adminCheck.error;

    console.log("[Admin Stats] Fetching stats...");

    // Get all user_project records for both project count and VCaaS details
    const allProjectsResult = await totalumSdk.crud.query("user_project", {
      _sort: { createdAt: "desc" },
      _limit: 200,
    });
    const projectRecords = Array.isArray(allProjectsResult.data) ? (allProjectsResult.data as Record<string, unknown>[]) : [];
    const totalProjects = projectRecords.length;

    // Count unique owners as a proxy for user count, or query users via getRecords
    let totalUsers = 0;
    try {
      const usersRes = await totalumSdk.crud.getRecords("user");
      const usersData = usersRes.data;
      totalUsers = Array.isArray(usersData) ? usersData.length : 0;
      console.log("[Admin Stats] getRecords returned", totalUsers, "users");
    } catch (err) {
      console.error("[Admin Stats] getRecords error:", err);
      // Fallback: count unique owners from project records
      const ownerIds = new Set(projectRecords.map(p => p.owner_id).filter(Boolean));
      totalUsers = ownerIds.size || 1; // at least 1 if we're here
    }

    let totalCreditsSpent = 0;
    let activeProjects = 0;

    // Fetch VCaaS details for each project (up to 50)
    await Promise.all(
      projectRecords.slice(0, 50).map(async (p) => {
        try {
          const res = await vcaasRequest(`/projects/${p.project_id}`);
          const json = (await res.json()) as { errors: unknown; data: Record<string, unknown> };
          if (!json.errors && json.data) {
            const credits = Number(json.data.totalCreditsSpent) || 0;
            totalCreditsSpent += credits;
            if (json.data.agentServerStatus === "Active") activeProjects++;
          }
        } catch (err) {
          console.log("[Admin Stats] Error fetching project:", p.project_id, err);
        }
      })
    );

    console.log("[Admin Stats] totalUsers:", totalUsers, "totalProjects:", totalProjects, "credits:", totalCreditsSpent, "active:", activeProjects);

    return NextResponse.json({
      ok: true,
      data: { totalUsers, totalProjects, totalCreditsSpent, activeProjects },
    });
  } catch (error) {
    console.error("[Admin Stats] Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch stats" }, { status: 500 });
  }
}
