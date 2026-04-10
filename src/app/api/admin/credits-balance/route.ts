import { getAdminSession } from "@/lib/admin-auth";
import { getVcaasApiKey } from "@/lib/vcaas";
import { NextResponse } from "next/server";

const CREDITS_BALANCE_URL = "https://api-accounts.totalum.app/api/v1/credits/balance";

export async function GET() {
  try {
    const adminCheck = await getAdminSession();
    if (adminCheck.error) return adminCheck.error;

    console.log("[Admin Credits] Fetching balance...");

    const response = await fetch(CREDITS_BALANCE_URL, {
      headers: { "api-key": getVcaasApiKey() },
    });

    const json = (await response.json()) as {
      success: boolean;
      data?: { credits: number };
      errors?: unknown;
    };

    if (!json.success || !json.data) {
      console.error("[Admin Credits] API error:", json.errors || "No data returned");
      return NextResponse.json(
        { ok: false, error: "Failed to fetch credits balance" },
        { status: 500 }
      );
    }

    console.log("[Admin Credits] Balance:", json.data.credits);

    return NextResponse.json({ ok: true, data: { balance: json.data.credits } });
  } catch (error) {
    console.error("[Admin Credits] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch credits balance" },
      { status: 500 }
    );
  }
}
