import { NextRequest, NextResponse } from "next/server";
import { isRoutableProjectSlug } from "@/app/api/vcaas/_shared";
import { vcaasRequest } from "@/lib/vcaas-server";

/**
 * `GET /api/vcaas/env/{projectId}?env=dev|live` → the project's `.env` file (new-engine projects).
 *
 * A dedicated route because upstream answers PLAIN TEXT, not the JSON envelope the catch-all expects. The text is
 * passed through unchanged (More → API keys copies it or saves it as a file); a refusal comes back as the usual
 * `{ ok: false, error, code }`.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const env = req.nextUrl.searchParams.get("env");
  if (!isRoutableProjectSlug(projectId) || (env !== "dev" && env !== "live")) {
    return NextResponse.json({ ok: false, error: "Invalid project or env", code: "VALIDATION_ERROR" }, { status: 400 });
  }
  try {
    const res = await vcaasRequest(`/projects/${projectId}/env?env=${env}`);
    if (res.ok && (res.headers.get("content-type") || "").startsWith("text/plain")) {
      return new NextResponse(await res.text(), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    const body = (await res.json().catch(() => null)) as { errors?: { errorCode?: string; errorMessage?: string } | null } | null;
    return NextResponse.json(
      { ok: false, error: body?.errors?.errorMessage || "Could not read the environment file", code: body?.errors?.errorCode || "UNKNOWN" },
      { status: res.ok ? 502 : res.status }
    );
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not read the environment file" }, { status: 500 });
  }
}
