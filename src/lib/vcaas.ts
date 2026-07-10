/**
 * Totalum VCaaS — the single service for everything that talks to the Totalum
 * VCaaS backend (`https://api-accounts.totalum.app/api/v1/vcaas`).
 *
 * The entire request path lives in this one file, split into two clearly
 * labeled layers that run in different runtimes:
 *
 *   ┌─ CLIENT LAYER (browser) ───────────────────────────────────────────────┐
 *   │  `vcaasApi` — the catalog of every VCaaS endpoint the UI calls. One      │
 *   │  documented function per endpoint (method, path, params, body, types).   │
 *   │  UI components import THIS and never hardcode `/api/vcaas/...` paths.     │
 *   │  Each function does a same-origin fetch to our proxy route `/api/vcaas/*`.│
 *   └─────────────────────────────────────────────────────────────────────────┘
 *                                    │  (same-origin request, no credential)
 *                                    ▼
 *   ┌─ SERVER LAYER (Route Handlers) ────────────────────────────────────────┐
 *   │  `vcaasRequest` / `vcaasUploadRequest` — the ONLY code that actually     │
 *   │  hits `api-accounts.totalum.app`. They attach the `api-key` credential   │
 *   │  read from the environment. Used exclusively by `src/app/api/vcaas/*`.   │
 *   └─────────────────────────────────────────────────────────────────────────┘
 *
 * How a call flows end to end:
 *   UI component → `vcaasApi.<endpoint>()`   (client layer, below)
 *     → same-origin `/api/vcaas/*` route     (Next.js Route Handler)
 *       → `vcaasRequest(...)`                 (server layer, below)
 *         → `https://api-accounts.totalum.app/api/v1/vcaas/*`  ← the real API
 *
 * Why this file carries no `"use client"` / `server-only` directive
 * ----------------------------------------------------------------
 * The two layers execute in different runtimes, so the module can carry neither
 * directive: `server-only` would forbid client components from importing the
 * catalog, and `"use client"` would turn the server transport into an unusable
 * client reference inside the route handlers. Staying directive-free lets both
 * layers live in one service.
 *
 * The API key stays safe regardless: it is a *non-public* env var (never
 * `NEXT_PUBLIC_`), so Next.js replaces `process.env.TOTALUM_VCAAS_API_KEY` with
 * `undefined` in any client bundle — the secret value can never reach the
 * browser. Only the server layer reads the key, and the client layer never
 * touches it.
 */

// Type-only import: erased at compile time, so it creates NO runtime dependency
// on the `"use client"` `@/lib/api` module (which the server layer must avoid).
import type { ApiResponse } from "@/lib/api";
import type {
  VcaasProject,
  VcaasProjectSummary,
  AgentStatus,
  AgentInputFile,
  ConversationMessage,
  ProjectVersion,
  DbTable,
  GithubStatus,
  GithubPullStatus,
  GithubConnectResult,
  GithubPullResult,
  GithubEnv,
  GithubSyncDirection,
} from "@/lib/vcaas-types";

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

// ═══════════════════════════════════════════════════════════════════════════
//  CLIENT LAYER — runs in the browser (imported by UI components)
//  The catalog of every VCaaS endpoint, each mapped to a same-origin
//  `/api/vcaas/*` proxy route. Never reads the API key.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Internal same-origin fetch to our `/api/vcaas/*` proxy routes, normalizing
 * every response to the app-wide `{ ok, data?, error? }` shape. This mirrors
 * `@/lib/api` but is inlined here so the service has no runtime dependency on a
 * `"use client"` module (see the header note on directives).
 */
async function proxyRequest<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, init);
    return (await res.json()) as ApiResponse<T>;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Thin typed verbs over `proxyRequest`, matching `@/lib/api`'s surface. */
const proxy = {
  get: <T>(url: string) => proxyRequest<T>(url),
  post: <T>(url: string, body: unknown) =>
    proxyRequest<T>(url, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) =>
    proxyRequest<T>(url, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) =>
    proxyRequest<T>(url, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(body) }),
  delete: <T>(url: string) => proxyRequest<T>(url, { method: "DELETE" }),
};

/** Root of the internal proxy. Everything below is relative to this. */
const API = "/api/vcaas";
/** Per-project path prefix, e.g. `/api/vcaas/projects/my-app`. */
const project = (projectId: string) => `${API}/projects/${projectId}`;

export const vcaasApi = {
  // ─────────────────────────── Projects ───────────────────────────
  // Final VCaaS endpoints: /vcaas/projects[/{projectId}]
  projects: {
    /** GET /vcaas/projects — list every project in the account. */
    list: (): Promise<ApiResponse<VcaasProjectSummary[]>> =>
      proxy.get<VcaasProjectSummary[]>(`${API}/projects`),

    /** GET /vcaas/projects/{projectId} — full detail for one project. */
    get: (projectId: string): Promise<ApiResponse<VcaasProject>> =>
      proxy.get<VcaasProject>(project(projectId)),

    /** POST /vcaas/projects — create a project. `projectId` becomes its URL slug. */
    create: (body: { projectId: string; description: string }): Promise<ApiResponse<VcaasProject>> =>
      proxy.post<VcaasProject>(`${API}/projects`, body),

    /** DELETE /vcaas/projects/{projectId} — permanently delete a project. */
    remove: (projectId: string): Promise<ApiResponse<unknown>> =>
      proxy.delete(project(projectId)),
  },

  // ──────────────────────────── Agent ─────────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/agent/*
  agent: {
    /** GET …/agent/status — current run status + realtime conversation (poll). */
    status: (projectId: string): Promise<ApiResponse<AgentStatus>> =>
      proxy.get<AgentStatus>(`${project(projectId)}/agent/status`),

    /** GET …/agent/full-conversation — the full persisted chat history. */
    fullConversation: (projectId: string): Promise<ApiResponse<{ conversation: ConversationMessage[] }>> =>
      proxy.get<{ conversation: ConversationMessage[] }>(`${project(projectId)}/agent/full-conversation`),

    /** POST …/agent/start — kick off an agent run with a prompt and optional files. */
    start: (projectId: string, body: { prompt: string; inputFiles: AgentInputFile[] }): Promise<ApiResponse<unknown>> =>
      proxy.post(`${project(projectId)}/agent/start`, body),

    /** POST …/agent/stop — request the current run to stop. */
    stop: (projectId: string): Promise<ApiResponse<unknown>> =>
      proxy.post(`${project(projectId)}/agent/stop`, {}),

    /** POST …/agent/server/start-or-restart — (re)start the project dev server. */
    restartServer: (projectId: string): Promise<ApiResponse<unknown>> =>
      proxy.post(`${project(projectId)}/agent/server/start-or-restart`, {}),
  },

  // ───────────────────────── Deployments ──────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/deployments/*
  deployments: {
    /** GET …/deployments/status — production deploy status (poll while deploying). */
    status: (projectId: string): Promise<ApiResponse<{ status: string }>> =>
      proxy.get<{ status: string }>(`${project(projectId)}/deployments/status`),

    /** POST …/deployments/deploy — publish the project to production. */
    deploy: (projectId: string): Promise<ApiResponse<unknown>> =>
      proxy.post(`${project(projectId)}/deployments/deploy`, {}),
  },

  // ──────────────────────────── GitHub ────────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/github/*
  github: {
    /** GET …/github/status — connection + token/branch info. */
    status: (projectId: string): Promise<ApiResponse<GithubStatus>> =>
      proxy.get<GithubStatus>(`${project(projectId)}/github/status`),

    /** GET …/github/pull-status — status of an in-progress pull/rebuild (poll). */
    pullStatus: (projectId: string): Promise<ApiResponse<GithubPullStatus>> =>
      proxy.get<GithubPullStatus>(`${project(projectId)}/github/pull-status`),

    /** POST …/github/connect — link a repo with a token and sync direction. */
    connect: (
      projectId: string,
      body: { token: string; repositoryFullName: string; syncDirection: GithubSyncDirection }
    ): Promise<ApiResponse<GithubConnectResult>> =>
      proxy.post<GithubConnectResult>(`${project(projectId)}/github/connect`, body),

    /** DELETE …/github/connect — unlink the repository (code is untouched). */
    disconnect: (projectId: string): Promise<ApiResponse<unknown>> =>
      proxy.delete(`${project(projectId)}/github/connect`),

    /** POST …/github/pull — pull the latest changes from GitHub. */
    pull: (projectId: string): Promise<ApiResponse<GithubPullResult>> =>
      proxy.post<GithubPullResult>(`${project(projectId)}/github/pull`, {}),

    /** GET …/github/env — the dev/prod `.env` contents synced from the repo. */
    env: (projectId: string): Promise<ApiResponse<GithubEnv>> =>
      proxy.get<GithubEnv>(`${project(projectId)}/github/env`),
  },

  // ─────────────────────────── Database ───────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/database/*
  database: {
    /** GET …/database/tables-structure — every table and its property schema. */
    tablesStructure: (projectId: string): Promise<ApiResponse<{ tables: DbTable[] }>> =>
      proxy.get<{ tables: DbTable[] }>(`${project(projectId)}/database/tables-structure`),

    /**
     * POST …/database/query — read records from a table.
     * `queryOptions` uses the Totalum query DSL (`_limit`, `_offset`, `_sort`,
     * `_filter`, `_count`, …).
     */
    query: (
      projectId: string,
      body: { tableName: string; queryOptions: Record<string, unknown> }
    ): Promise<ApiResponse<{ results: Record<string, unknown>[] }>> =>
      proxy.post<{ results: Record<string, unknown>[] }>(`${project(projectId)}/database/query`, body),

    /** POST …/database/records — create one record in `tableName`. */
    createRecord: (
      projectId: string,
      body: { tableName: string; data: Record<string, unknown> }
    ): Promise<ApiResponse<unknown>> =>
      proxy.post(`${project(projectId)}/database/records`, body),

    /** PATCH …/database/records/{recordId} — update one record. */
    updateRecord: (
      projectId: string,
      recordId: string,
      body: { tableName: string; data: Record<string, unknown> }
    ): Promise<ApiResponse<unknown>> =>
      proxy.patch(`${project(projectId)}/database/records/${recordId}`, body),

    /**
     * DELETE …/database/records/{recordId}?tableName=… — delete one record.
     * `tableName` is a required query param (which table the id belongs to).
     */
    deleteRecord: (projectId: string, recordId: string, tableName: string): Promise<ApiResponse<unknown>> =>
      proxy.delete(`${project(projectId)}/database/records/${recordId}?tableName=${encodeURIComponent(tableName)}`),
  },

  // ──────────────────────────── Secrets ───────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/secrets[/{secretId}]
  secrets: {
    /** POST …/secrets — create an env secret for `development`/`production`/`both`. */
    create: (
      projectId: string,
      body: { secretName: string; secretValue: string; environment: string }
    ): Promise<ApiResponse<unknown>> =>
      proxy.post(`${project(projectId)}/secrets`, body),

    /** DELETE …/secrets/{secretId} — delete a secret. */
    remove: (projectId: string, secretId: string): Promise<ApiResponse<unknown>> =>
      proxy.delete(`${project(projectId)}/secrets/${secretId}`),
  },

  // ──────────────────────── Custom domain ─────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/domain
  domain: {
    /** PUT …/domain — attach a custom hostname (project must be deployed first). */
    set: (projectId: string, body: { hostname: string }): Promise<ApiResponse<unknown>> =>
      proxy.put(`${project(projectId)}/domain`, body),

    /** DELETE …/domain — remove the custom domain. */
    remove: (projectId: string): Promise<ApiResponse<unknown>> =>
      proxy.delete(`${project(projectId)}/domain`),
  },

  // ─────────────────────────── Versions ───────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/versions[/{versionId}/recover]
  versions: {
    /** GET …/versions?limit=&skip= — paginated version history. */
    list: (
      projectId: string,
      opts: { limit?: number; skip?: number } = {}
    ): Promise<ApiResponse<{ versions: ProjectVersion[]; totalCount: number }>> => {
      const limit = opts.limit ?? 50;
      const skip = opts.skip ?? 0;
      return proxy.get<{ versions: ProjectVersion[]; totalCount: number }>(
        `${project(projectId)}/versions?limit=${limit}&skip=${skip}`
      );
    },

    /** POST …/versions/{versionId}/recover — restore a past version. */
    recover: (projectId: string, versionId: string): Promise<ApiResponse<unknown>> =>
      proxy.post(`${project(projectId)}/versions/${versionId}/recover`, {}),
  },

  // ──────────────────────────── Logs ──────────────────────────────
  // Final VCaaS endpoint: /vcaas/projects/{id}/backend/dev/logs
  logs: {
    /**
     * GET …/backend/dev/logs — the single per-project log stream. The dev server
     * (PORT 80) serves BOTH the preview and the published site, so this one
     * endpoint contains everything, including runtime activity from production.
     */
    dev: (projectId: string): Promise<ApiResponse<{ logs: string }>> =>
      proxy.get<{ logs: string }>(`${project(projectId)}/backend/dev/logs`),
  },

  // ─── Non-JSON endpoints (dedicated internal routes, not the catch-all) ───

  /**
   * GET /api/vcaas/git-diff?url=… — fetch a unified git diff.
   *
   * The diff itself lives at a signed storage URL that a conversation message
   * carries (`gitDiffUrl`). The dedicated route downloads it server-side (with an
   * SSRF allow-list) and returns `{ diff }`, so the browser never fetches the
   * external URL directly.
   */
  gitDiff: (url: string): Promise<ApiResponse<{ diff: string }>> =>
    proxy.get<{ diff: string }>(`${API}/git-diff?url=${encodeURIComponent(url)}`),

  /**
   * GET /api/vcaas/source-code/{projectId} — download the project source as a ZIP.
   *
   * Returns the raw `Response` (not the `{ ok, data }` envelope) because the body
   * is a binary archive the caller streams/decompresses itself. On error the
   * route responds with JSON `{ ok:false, error }`; check `content-type`.
   */
  sourceCode: (projectId: string): Promise<Response> =>
    fetch(`${API}/source-code/${projectId}`, { cache: "no-store" }),

  /**
   * POST /api/vcaas/upload/{projectId} — upload one file (multipart/form-data).
   *
   * Uploads can't use the JSON `proxy` verbs, so this uses raw fetch and returns
   * the parsed `{ ok, data?, error? }` envelope. Maps to the final VCaaS
   * file-upload endpoint. `formData` must contain a `file` field.
   */
  upload: async (
    projectId: string,
    formData: FormData
  ): Promise<{ ok: boolean; data?: { url: string; fileNameId: string }; error?: string }> => {
    const res = await fetch(`${API}/upload/${projectId}`, { method: "POST", body: formData });
    return (await res.json()) as { ok: boolean; data?: { url: string; fileNameId: string }; error?: string };
  },
};
