import { NextRequest, NextResponse } from "next/server";
import { vcaasRequest } from "@/lib/vcaas-server";

// Binary source-code proxy. Fetches the VCaaS source-code signed URL, then
// downloads the ZIP archive SERVER-SIDE (avoids browser CORS on the storage
// host) and streams the raw bytes back to the client with Content-Type
// application/zip plus x-files-count and x-commit-sha metadata headers.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    // 1) Ask VCaaS for the signed download URL + metadata.
    const metaRes = await vcaasRequest(`/projects/${projectId}/source-code`);
    const metaJson = (await metaRes.json()) as {
      errors: { errorCode: string; errorMessage: string } | null;
      data: { filesCount?: number; lastCommitSha?: string; downloadUrl?: string | null } | null;
    };

    if (metaJson.errors || !metaJson.data?.downloadUrl) {
      const errorMessage =
        metaJson.errors?.errorMessage ||
        "No download URL returned for project source code";
      // Map known VCaaS error codes to sensible HTTP statuses.
      const code = metaJson.errors?.errorCode;
      const status =
        code === "PROJECT_NOT_FOUND"
          ? 404
          : code === "INSUFFICIENT_CREDITS"
          ? 402
          : code === "MISSING_PROJECT_ID"
          ? 400
          : metaRes.ok
          ? 502
          : metaRes.status || 500;
      return NextResponse.json({ ok: false, error: errorMessage }, { status });
    }

    const { downloadUrl, filesCount, lastCommitSha } = metaJson.data;

    // 2) Download the ZIP archive server-side.
    const zipRes = await fetch(downloadUrl);
    if (!zipRes.ok) {
      return NextResponse.json(
        { ok: false, error: `Failed to download source archive (HTTP ${zipRes.status})` },
        { status: 502 }
      );
    }

    const buffer = await zipRes.arrayBuffer();

    // 3) Return raw ZIP bytes with metadata headers.
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(buffer.byteLength),
        "x-files-count": String(filesCount ?? 0),
        "x-commit-sha": String(lastCommitSha ?? ""),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to fetch source code" },
      { status: 500 }
    );
  }
}
