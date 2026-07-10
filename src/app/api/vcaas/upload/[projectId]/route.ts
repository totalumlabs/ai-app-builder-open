import { NextRequest, NextResponse } from "next/server";
import { vcaasUploadRequest } from "@/lib/vcaas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Forward the multipart form data straight through to the VCaaS endpoint.
    const formData = await req.formData();
    const response = await vcaasUploadRequest(
      `/projects/${projectId}/files/upload`,
      formData
    );

    const json = (await response.json()) as { errors: { errorCode: string; errorMessage: string } | null; data: unknown };

    if (json.errors) {
      return NextResponse.json(
        { ok: false, error: json.errors.errorMessage },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, data: json.data });
  } catch {
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}
