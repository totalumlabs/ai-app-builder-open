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
/**
 * Base URL for every Totalum API endpoint. Single source of truth.
 * 📖 API reference: https://www.totalum.app/totalum-api.md
 *
 * `builder-api.totalum.app` is the Totalum API host (`api-accounts.totalum.app`, the older host, answers the same
 * paths). `TOTALUM_API_URL` points the app at another Totalum environment — an origin only, the `/api/v1/vcaas`
 * prefix is added here.
 */
export const TOTALUM_API_ORIGIN = new URL(process.env.TOTALUM_API_URL || "https://builder-api.totalum.app").origin;
const VCAAS_BASE_URL = `${TOTALUM_API_ORIGIN}/api/v1/vcaas`;

/**
 * ═══⭐⭐⭐ EVERY UPSTREAM URL MUST STAY INSIDE `/api/v1/vcaas/` ═══════════════
 *
 * ⚠️⚠️ THIS APP HOLDS AN ACCOUNT-WIDE KEY AND HAS NO LOGIN. The key authorises far
 * more than the VCaaS surface — API-key management, billing, account settings — so
 * the only thing keeping a request on the intended surface is that every proxied
 * path lands under `/api/v1/vcaas/`.
 *
 * ⚠️⚠️ AND A NAIVE JOIN DOES NOT GUARANTEE IT. Paths are built from route params,
 * which the framework hands over already decoded, so a traversal segment (dot-dot, in
 * any of its encoded or backslash spellings) can survive into the joined string; `fetch`
 * then normalises it and the request can land OUTSIDE `/api/v1/vcaas/`, on another part
 * of the account API the key also authorises.
 *
 * ⚠️ SO THE CHECK RUNS ON THE URL `fetch` WILL ACTUALLY REQUEST, not on the string
 * we built. Filtering dot segments out of the input is a losing game (encodings,
 * backslashes, double-decoding); resolving the URL first and then checking where it
 * points is the one test that cannot be talked around. Both request helpers go through
 * here, so no route can forget it.
 */
const VCAAS_ORIGIN = new URL(VCAAS_BASE_URL).origin;
const VCAAS_PATH_PREFIX = new URL(VCAAS_BASE_URL).pathname; // "/api/v1/vcaas"

export class VcaasPathError extends Error {
  constructor(path: string) {
    super(`Refused to proxy a path outside the VCaaS API: ${JSON.stringify(path)}`);
    this.name = "VcaasPathError";
  }
}

/** Resolve `path` against the API base and refuse anything that escapes it. */
export function resolveVcaasUrl(path: string): string {
  if (typeof path !== "string" || !path.startsWith("/")) throw new VcaasPathError(String(path));

  /**
   * ⚠️ DEFENCE IN DEPTH — REFUSE AN ENCODED TRAVERSAL IN THE PATH ITSELF. The real
   * request cannot reach here still-encoded (route params arrive decoded, so a traversal
   * arrives as `/../…` and the origin+prefix check below stops it). But a
   * `%2e`/`%2f`/`%5c` left in the PATH would pass that check as an opaque segment and
   * could be decoded by the upstream server into a traversal. The QUERY STRING is left
   * untouched — `files/content?path=src%2Fapp%2Fpage.tsx` is legitimate and common.
   */
  const pathOnly = path.split("?", 1)[0].toLowerCase();
  if (/%2e|%2f|%5c/.test(pathOnly)) throw new VcaasPathError(path);

  const url = new URL(`${VCAAS_BASE_URL}${path}`);
  const inside = url.pathname === VCAAS_PATH_PREFIX || url.pathname.startsWith(`${VCAAS_PATH_PREFIX}/`);
  if (url.origin !== VCAAS_ORIGIN || !inside) throw new VcaasPathError(path);
  return url.toString();
}

// ═══════════════════════════════════════════════════════════════════════════
//  SERVER LAYER — runs only inside Route Handlers (`src/app/api/vcaas/*`)
//  Reads the API key and is the only code that calls the Totalum API.
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

  return fetch(resolveVcaasUrl(path), {
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
  return fetch(resolveVcaasUrl(path), {
    method: "POST",
    headers: { "api-key": getVcaasApiKey() },
    body: formData,
  });
}
