/**
 * Catch-all proxy: `/api/vcaas/<path>` → `https://api-accounts.totalum.app/api/v1/vcaas/<path>`
 * with the operator's `api-key` header added server-side.
 *
 * 📖 What each forwarded path accepts and returns: https://www.totalum.app/totalum-api.md
 */
import { vcaasRequest } from "@/lib/vcaas-server";
import { normalizeVcaasError, toErrorEnvelope } from "@/lib/vcaas-errors";
import { NextRequest, NextResponse } from "next/server";

interface VcaasApiResponse {
  /**
   * ⚠️ `errorDetails` IS OPTIONAL AND LOAD-BEARING. totalum-backend uses it to
   * separate two situations that share one `errorCode` — `SANDBOX_NOT_REACHABLE`
   * means both "the app is still starting" and "the app is broken", which need
   * opposite advice. Forwarding it is what lets the workspace say which.
   */
  errors:
    | {
        errorCode: string;
        errorMessage: string;
        errorDetails?: { reason?: string; httpStatus?: number };
      }
    | null;
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

    /**
     * ═══⭐⭐ THE ERROR ENVELOPE THE WORKSPACE SWITCHES ON ══════════════════
     *
     * ⚠️⚠️ THIS USED TO EMIT `errorCode`, WHICH NOTHING READS. The client layer and
     * every panel expect `{ ok:false, error, code, upstreamCode }` — `code` is a
     * small stable union to branch on, `upstreamCode` is VCaaS's own name kept
     * intact. Two features depend on the raw name surviving the hop: the wake
     * (`SERVER_NOT_READY`, which normalises to `UNKNOWN` because it is not in the
     * stable union) and the publish refusal (`SANDBOX_NOT_REACHABLE`). With only
     * `errorCode` on the wire, both were invisible to the UI.
     */
    if (json.errors) {
      const normalized = normalizeVcaasError(json.errors, response.status);
      return NextResponse.json(toErrorEnvelope(normalized), { status: normalized.status });
    }

    return NextResponse.json(
      { ok: true, data: json.data },
      { status: 200 }
    );
  } catch (error) {
    /**
     * ⚠️ IT USED TO SWALLOW THE REASON. Every failure in here — a body that could not be
     * read, an upstream that answered non-JSON, a thrown fetch — came out as the same
     * opaque "Internal server error" toast with nothing in the server log to explain it,
     * which is a debugging dead end for the one layer every request passes through.
     */
    console.error(`[vcaas] ${req.method} proxy failed:`, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error", code: "UNKNOWN", data: null },
      { status: 500 }
    );
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
