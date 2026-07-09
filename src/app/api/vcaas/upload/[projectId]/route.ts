import { NextRequest, NextResponse } from "next/server";

const VCAAS_BASE_URL = "https://api-accounts.totalum.app/api/v1/vcaas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const apiKey = process.env.VCAAS_API_KEY || "";

    // Forward the multipart form data directly
    const formData = await req.formData();

    const response = await fetch(
      `${VCAAS_BASE_URL}/projects/${projectId}/files/upload`,
      {
        method: "POST",
        headers: { "api-key": apiKey },
        body: formData,
      }
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
