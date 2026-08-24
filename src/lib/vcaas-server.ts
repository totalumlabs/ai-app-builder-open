/**
 * ═══ THE SERVER LAYER — SPLIT OUT SO THE CLIENT CAN BE A STRAIGHT COPY ══════
 *
 * ⚠️ THIS FILE EXISTS BECAUSE `src/lib/vcaas.ts` IS NOW A VERBATIM COPY of
 * totalum-platform's client, and the platform keeps its key-holding half in
 * `vcaas-server.ts`. Same split, same file name, so both repos can take each
 * other's changes without a merge. Everything below is this project's original
 * server code, moved rather than rewritten.
 *
 * ⚠️ NEVER IMPORT THIS FROM A CLIENT COMPONENT. It reads the API key.
 */
/** Base URL for every Totalum VCaaS API endpoint. Single source of truth. */
const VCAAS_BASE_URL = "https://api-accounts.totalum.app/api/v1/vcaas";

// ═══════════════════════════════════════════════════════════════════════════
//  SERVER LAYER — runs only inside Route Handlers (`src/app/api/vcaas/*`)
//  Reads the API key and is the only code that hits api-accounts.totalum.app.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The Totalum VCaaS API key, read from the environment.
 *
 * This is the only credential the app requires (see README). The documented
 * name is `TOTALUM_VCAAS_API_KEY`; the legacy `VCAAS_API_KEY` is still accepted
 * as a fallback so older setups keep working. Returns an empty string when
 * unset so callers still get a structured `{ errors }` response from VCaaS (an
 * auth error) rather than a thrown exception.
 *
 * Server-only in practice: on the client `process.env.TOTALUM_VCAAS_API_KEY` is
 * `undefined` (non-public env var), so this returns `""` there — but the client
 * layer never calls it.
 */
export function getVcaasApiKey(): string {
  return process.env.TOTALUM_VCAAS_API_KEY || process.env.VCAAS_API_KEY || "";
}

/**
 * Make a JSON request to a VCaaS endpoint and return the raw `Response`.
 *
 * `Content-Type: application/json` is set automatically whenever a body is
 * present; do NOT use this for multipart uploads (use `vcaasUploadRequest`),
 * because a hardcoded JSON content-type would corrupt the multipart boundary.
 *
 * @param path    Endpoint path after `/api/v1/vcaas`, e.g. `/projects/${id}`.
 * @param options Standard fetch options (method, body, ...). The `api-key`
 *                header is injected here and should not be passed in.
 */
export async function vcaasRequest(
  path: string,
  options: RequestInit = {},
  /**
   * ⚠️ ACCEPTED AND IGNORED, ON PURPOSE. totalum-platform's signature takes a per-user
   * context here because each of its users has their own hidden VCaaS key; this app has
   * exactly one key in its environment. Keeping the parameter means a route copied from
   * the platform compiles and behaves correctly without an edit — see `api/vcaas/_shared`.
   */
  _ctx?: { accountUserId?: string }
): Promise<Response> {
  const headers: Record<string, string> = {
    "api-key": getVcaasApiKey(),
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${VCAAS_BASE_URL}${path}`, {
    ...options,
    headers,
  });
}

/**
 * Make a multipart/form-data request to a VCaaS endpoint (e.g. file uploads).
 *
 * Only the `api-key` header is set — the `Content-Type` (with its multipart
 * boundary) is left for `fetch` to derive from the `FormData` body, which is
 * why uploads can't reuse `vcaasRequest`.
 *
 * @param path     Endpoint path after `/api/v1/vcaas`,
 *                 e.g. `/projects/${id}/files/upload`.
 * @param formData The multipart payload to forward.
 */
export async function vcaasUploadRequest(
  path: string,
  formData: FormData
): Promise<Response> {
  return fetch(`${VCAAS_BASE_URL}${path}`, {
    method: "POST",
    headers: { "api-key": getVcaasApiKey() },
    body: formData,
  });
}
