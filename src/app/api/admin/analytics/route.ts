import { getAdminSession } from "@/lib/admin-auth";
import { getVcaasApiKey } from "@/lib/vcaas";
import { NextRequest, NextResponse } from "next/server";

const ANALYTICS_BASE_URL = "https://api-accounts.totalum.app/api/v1/credits/spending-analytics";

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await getAdminSession();
    if (adminCheck.error) return adminCheck.error;

    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const projectId = searchParams.get("projectId");

    if (!from || !to) {
      return NextResponse.json(
        { ok: false, error: "Missing required parameters: from, to" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({ from, to });
    if (projectId) params.set("projectId", projectId);

    const url = `${ANALYTICS_BASE_URL}?${params.toString()}`;
    console.log("[Admin Analytics] Fetching:", url);

    const response = await fetch(url, {
      headers: { "api-key": getVcaasApiKey() },
    });

    const json = (await response.json()) as {
      errors: unknown;
      data: {
        daily: Array<{
          date: string;
          development: number;
          infrastructure: number;
          byType: Record<string, number>;
        }>;
        totals: {
          development: number;
          infrastructure: number;
          total: number;
          byType: Record<string, number>;
        };
        projects: string[];
      };
    };

    if (json.errors) {
      console.error("[Admin Analytics] API error:", json.errors);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch analytics" },
        { status: 500 }
      );
    }

    console.log("[Admin Analytics] Success - days:", json.data?.daily?.length, "total:", json.data?.totals?.total);

    return NextResponse.json({ ok: true, data: json.data });
  } catch (error) {
    console.error("[Admin Analytics] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
