import "server-only";

/**
 * Totalum VCaaS API service.
 *
 * This is the single place where the app talks to the Totalum VCaaS backend
 * (`https://api-accounts.totalum.app/api/v1/vcaas`). Every outbound call to a
 * VCaaS *final endpoint* goes through one of the request helpers below, so the
 * base URL and the `api-key` credential live in exactly one file.
 *
 * Architecture
 * ------------
 *   Browser component
 *     → calls our internal `/api/vcaas/*` route  (via `@/lib/api`)
 *       → the route handler calls a helper HERE   (`vcaasRequest` / `vcaasUploadRequest`)
 *         → which is the only code that actually hits `api-accounts.totalum.app`.
 *
 * `server-only` guarantees this module (and the API key it reads) can never be
 * bundled into client-side JavaScript.
 *
 * Adding a new call
 * -----------------
 * Don't `fetch("https://api-accounts.totalum.app/...")` from a route handler.
 * Use `vcaasRequest(path, options)` for JSON endpoints, or
 * `vcaasUploadRequest(path, formData)` for multipart/form-data (file uploads).
 * `path` is everything after `/api/v1/vcaas`, e.g. `/projects/${id}/agent/status`.
 *
 * Note: downloading a *signed storage URL* that a VCaaS endpoint returns (e.g.
 * the source-code ZIP or a git-diff file on `storage.googleapis.com`) is a plain
 * file download, not a VCaaS API call, so it intentionally does not go through
 * these helpers — those routes fetch the returned URL directly.
 */

/** Base URL for every Totalum VCaaS API endpoint. Single source of truth. */
const VCAAS_BASE_URL = "https://api-accounts.totalum.app/api/v1/vcaas";

/**
 * The Totalum VCaaS API key, read from the environment.
 *
 * This is the only credential the app requires (see README). Returns an empty
 * string when unset so callers still get a structured `{ errors }` response
 * from VCaaS (an auth error) rather than a thrown exception.
 */
export function getVcaasApiKey(): string {
  return process.env.VCAAS_API_KEY || "";
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
  options: RequestInit = {}
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
