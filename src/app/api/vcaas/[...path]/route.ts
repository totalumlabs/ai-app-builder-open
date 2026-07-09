import { vcaasRequest } from "@/lib/vcaas";
import { NextRequest, NextResponse } from "next/server";

interface VcaasApiResponse {
  errors: { errorCode: string; errorMessage: string } | null;
  data: unknown;
}

async function handleRequest(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const vcaasPath = "/" + path.join("/");

    // Forward query parameters
    const url = new URL(req.url);
    const queryString = url.searchParams.toString();
    const fullPath = queryString ? `${vcaasPath}?${queryString}` : vcaasPath;

    // Get body for non-GET/HEAD requests
    let body: string | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      try {
        const text = await req.text();
        if (text) body = text;
      } catch {
        // No body
      }
    }

    const response = await vcaasRequest(fullPath, {
      method: req.method,
      body,
    });

    const json = (await response.json()) as VcaasApiResponse;

    // Transform VCaaS response format to our { ok, data, error } format
    if (json.errors) {
      return NextResponse.json(
        {
          ok: false,
          error: json.errors.errorMessage,
          errorCode: json.errors.errorCode,
          data: null,
        },
        { status: response.status >= 400 ? response.status : 400 }
      );
    }

    return NextResponse.json(
      { ok: true, data: json.data },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
