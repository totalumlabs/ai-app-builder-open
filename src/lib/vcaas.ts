/**
 * Totalum API — the CLIENT CATALOG: one documented function per endpoint, each
 * mapped to a same-origin `/api/vcaas/*` proxy route.
 *
 * 📖 THE API REFERENCE FOR EVERY ENDPOINT IN THIS FILE:
 *    https://www.totalum.app/totalum-api.md
 *    (one Markdown file with the whole core API; it links to the optional areas —
 *    GitHub, Figma, database, webhooks, files, project transfer, project groups).
 *    Read it before adding or changing a function here. Do not vendor a copy.
 *
 * The client and server halves live in two files, and the split is a FILE BOUNDARY
 * on purpose:
 *
 *   ┌─ CLIENT LAYER — THIS FILE ─────────────────────────────────────────────┐
 *   │  `vcaasApi`. UI components import this and never hardcode an            │
 *   │  `/api/vcaas/...` path. Same-origin fetch, NO credential, no env var,   │
 *   │  no reference to any module that holds either.                          │
 *   └─────────────────────────────────────────────────────────────────────────┘
 *                                    │  (same-origin request, no credential)
 *                                    ▼
 *   ┌─ SERVER LAYER — `vcaas-server.ts` ─────────────────────────────────────┐
 *   │  `vcaasRequest` / `vcaasUploadRequest`. `server-only`. The ONLY code    │
 *   │  that reads the API key and calls the Totalum API. Imported exclusively │
 *   │  by `src/app/api/vcaas/*`.                                              │
 *   └─────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ WHY A FILE BOUNDARY AND NOT A COMMENT. A single module holding both layers and
 * importing the server half lazily (`await import(...)`) does NOT keep it out of
 * client bundles — Webpack traces dynamic imports statically, so the first
 * `"use client"` component to import `vcaasApi` fails the production build with
 * "You're importing a component that needs server-only". Keeping the key-holding
 * code in its own `server-only` module is what makes the guarantee structural.
 *
 * KEEP THIS FILE FREE OF: `process.env` reads, `crypto`, `node:*` imports, and any
 * import of `@/lib/vcaas-server`.
 */

// Type-only import: erased at compile time, so it creates NO runtime dependency on
// the `"use client"` `@/lib/api` module.
import type { SiteAnalyticsAnswer } from "./site-analytics";
import { toBase64 } from "@/lib/base64";
import type { ApiResponse } from "@/lib/api";
import type { VcaasErrorCode, VcaasErrorDetails } from "@/lib/vcaas-errors";
import type { PaymentsMode, PaymentsStatus, ProjectWebhook } from "@/lib/v2-payments";
import type { DbRestorePoint } from "@/lib/undo-db-change";
import type {
  ProjectGroup,
  VcaasProject,
  VcaasProjectSummary,
  AgentStatus,
  AgentInputFile,
  AgentRunOptions,
  ConversationHistory,
  ConversationMessage,
  ProjectVersion,
  FileTree,
  FileContent,
  FileWriteResult,
  GithubStatus,
  GithubPullStatus,
  GithubConnectResult,
  GithubPullResult,
  GithubEnv,
  GithubSyncDirection,
  ProjectExportResult,
  ProjectImportResult,
  FigmaStatus,
  FigmaConnectResult,
  FigmaValidateResult,
  VcaasWebhook,
  ProjectLaunchResult,
  VcaasDeployError,
  AccountDomain,
  DomainDnsRecord,
  DomainDnsRecordInput,
  DomainForward,
  CronJob,
  CronRun,
  DbBackup,
  DbBackupSchedule,
  DbEnv,
  DomainSearchResult,
  FeatureKey,
  FeatureLimit,
  McpServer,
  MobileBuild,
  MobileSettings,
  OwnBuildKey,
  MobileStores,
  StoreUpload,
  ProjectApiKey,
  ProjectLimits,
  ProjectCreditLimits,
  AtLimitAnswer,
  SqlAskResult,
  SqlRows,
  SqlSchema,
  DbUsage,
  V2Usage,
} from "@/lib/vcaas-types";

/**
 * Paging state for a list endpoint.
 *
 * VCaaS returns this in RESPONSE HEADERS (`X-Total-Count`, `X-Limit`, `X-Skip`,
 * `X-Has-More`); our proxy folds them into the envelope — see `readPageMeta` in
 * `src/app/api/vcaas/_shared.ts`. Present only on endpoints that send them.
 */
export interface VcaasPageMeta {
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}

/** What a failed `/api/vcaas/*` call adds on top of `ApiResponse`. */
export interface VcaasResponse<T> extends ApiResponse<T> {
  /** The stable union from `vcaas-errors.ts`. Present only when `ok` is false. */
  code?: VcaasErrorCode;
  upstreamCode?: string;
  /**
   * Upstream's detail for the codes that carry more than a message:
   * `SANDBOX_NOT_REACHABLE` (`reason: "starting" | "app_error"`) and
   * `MAX_PROJECTS_REACHED` (`maxProjects`, `projectsUsed`, `plan`, `upgradePlan`).
   * Every field is optional — see `VcaasErrorDetails` in `vcaas-errors.ts`.
   */
  details?: VcaasErrorDetails;
  /** Header-derived paging state. Present only on paginated list endpoints. */
  meta?: VcaasPageMeta;
  /**
   * ⚠️ `false` MEANS "DO NOT TRY AGAIN". Set by the upload proxy so a refusal that can
   * never succeed — a file over the size limit, above all — is not retried three times
   * before the user is told. Absent everywhere else, where the caller decides.
   */
  retryable?: boolean;
  /** The HTTP status of a failed call (absent on success and on a transport failure). */
  status?: number;
}

/**
 * `GET …/deployments/status`. A new-engine project adds `deploymentId`, `step`, `liveUrl` and, on a failed publish,
 * `errorDetails` (why it failed and what to do); a legacy one carries `versionId` instead.
 */
export interface DeploymentStatus {
  status: string | null;
  createdAt?: string | null;
  deploymentId?: string;
  step?: string;
  liveUrl?: string;
  errorDetails?: VcaasDeployError;
}

/** A custom MCP server as the user types it (header values are write-only). */
export interface McpServerDraft {
  name: string;
  transport: "http" | "sse";
  url: string;
  headers?: Record<string, string>;
}

/**
 * Internal same-origin fetch to our `/api/vcaas/*` proxy routes, normalizing every
 * response to the app-wide `{ ok, data?, error? }` shape (plus `code`). Mirrors
 * `@/lib/api` but is inlined so the service has no runtime dependency on a
 * `"use client"` module (see the header note on directives).
 */
/**
 * ═══ THE GLOBAL INSUFFICIENT-CREDITS SIGNAL ══════════════════════
 *
 * The brief asks the modal to fire "on `INSUFFICIENT_CREDITS` from ANY VCaaS call".
 * `proxyRequest` is the one chokepoint every one of the ~40 `vcaasApi` methods
 * passes through, so the signal is raised here exactly once rather than at forty
 * call sites — where the next endpoint added would inevitably forget it.
 *
 * ⚠️ A DOM EVENT, NOT A DIRECT CALL, because this module is deliberately NOT a
 * `"use client"` React module (see the note on `proxyRequest`) and so cannot touch
 * a React context. `<CreditsProvider>` subscribes and opens the modal.
 *
 * ⚠️ IT ONLY NOTIFIES — IT NEVER SWALLOWS. The response is returned unchanged, so
 * every existing caller's error handling behaves exactly as it did before this
 * phase. Surfaces with bespoke credit copy (the create-project dialog) keep it.
 */
export const INSUFFICIENT_CREDITS_EVENT = "totalum:insufficient-credits";

function signalInsufficientCredits(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INSUFFICIENT_CREDITS_EVENT));
}

async function proxyRequest<T>(url: string, init?: RequestInit): Promise<VcaasResponse<T>> {
  try {
    const res = await fetch(url, init);
    const payload = (await res.json()) as VcaasResponse<T>;

    if (payload?.ok === false && payload.code === "INSUFFICIENT_CREDITS") {
      signalInsufficientCredits();
    }

    // A failure says its HTTP status, so a caller can tell a refusal (4xx) from an outage.
    return payload?.ok === false ? { ...payload, status: res.status } : payload;
  } catch (err) {
    // A transport failure never reached our route, so there is no upstream code.
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: "UNKNOWN",
    };
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
  /**
   * A DELETE that carries a body (Feature H3 — dropping a many-to-many link
   * needs `{ tableName, propertyId, referenceId }`).
   *
   * ⚠️ Separate from `delete` on purpose: a body on DELETE is legal but unusual,
   * and every existing caller of `delete` must keep sending none.
   */
  deleteWithBody: <T>(url: string, body: unknown) =>
    proxyRequest<T>(url, { method: "DELETE", headers: JSON_HEADERS, body: JSON.stringify(body) }),
};

/** Root of the internal proxy. Everything below is relative to this. */
const API = "/api/vcaas";
/** Per-project path prefix, e.g. `/api/vcaas/projects/my-app`. */
const project = (projectId: string) => `${API}/projects/${encodeURIComponent(projectId)}`;

export const vcaasApi = {
  // ─────────────────────────── Projects ───────────────────────────
  // Final VCaaS endpoints: /vcaas/projects[/{projectId}]
  projects: {
    /**
     * GET /vcaas/projects — list the SIGNED-IN USER's projects.
     *
     * (In the open repo this listed every project in one shared account; here the
     * request carries the caller's own account-scoped key, so it is already
     * per-user. See `vcaas-types.ts`.)
     *
     * ⚠️ OLDER DOCS ARE STALE HERE — including the vendored copy this repo used to
     * carry, now deleted in favour of `www.totalum.app/docs/api` (see
     * `API_REFERENCE_MARKDOWN_URL`). They
     * document this endpoint as returning a plain array with no paging. The live
     * controller (`vcaas.controller.ts → listProjects`) accepts `limit`, `skip`,
     * `search` and `sortDirection`, and answers with `X-Total-Count` / `X-Limit` /
     * `X-Skip` / `X-Has-More`. Those headers arrive on `response.meta`.
     *
     * Server-side limits, verified against the controller:
     *   · `LIST_PROJECTS_DEFAULT_LIMIT = 100`, `LIST_PROJECTS_MAX_LIMIT = 100`
     *     — a larger `limit` is silently clamped to 100, never rejected.
     *   · `search` regex-matches `organizationId`, `label`, `description` and
     *     `projectDescription`, case-insensitively, with the input escaped.
     *     (`label` — the title actually shown on a card — was added upstream in
     *     `InstanceService.listUserInstances`; searching for the visible name of a
     *     project used to return nothing.)
     *   · `createdFrom` / `createdTo` bound `createdAt` INCLUSIVELY. Both optional
     *     and independent. Send full ISO instants — see `dateRange` below.
     *   · `sortField` accepts `'lastModified'` and NOTHING ELSE — anything other
     *     than that literal falls back to creation date upstream, including a
     *     misspelling, so this is a two-value switch and not a general sort API.
     *     **There is still NO server-side NAME sort**; see `SORT_MODES` in
     *     `src/lib/project-sort.ts` for how the dashboard handles that.
     */
    list: (params?: {
      limit?: number;
      skip?: number;
      search?: string;
      sortDirection?: "asc" | "desc";
      /**
       * ⭐ `"lastModified"` orders by when the project last CHANGED (a prompt, a
       * deploy, a rename, a file edit) instead of when it was created.
       *
       * ⚠️ SERVER-SIDE, WHICH IS THE ONLY WAY IT COULD BE CORRECT. Sorting a paged
       * list locally would order one arbitrary page — see the long note at the top
       * of `project-sort.ts`, which is why name sorting has to fetch 100 rows.
       *
       * ⚠️ IGNORED BY AN ACCOUNT-BACKEND OLDER THAN THIS FEATURE. It answers with
       * creation order and no `lastModifiedAt` on the items; the dashboard degrades
       * to showing the creation date in that column rather than breaking.
       */
      sortField?: "lastModified";
      /**
       * Narrow to one group, or to `"none"` for the ungrouped ones.
       *
       * ⚠️ OMITTED MEANS EVERYTHING — grouped and ungrouped alike. Filing a project
       * into a group must never remove it from the main list, or groups become a
       * place projects go to disappear.
       */
      groupId?: string;
      /**
       * Creation-date window, INCLUSIVE at both ends. Either bound may stand alone.
       *
       * ⚠️ FULL ISO INSTANTS, NOT `YYYY-MM-DD`. Only the browser knows the user's
       * timezone, so it is the only party that can say when "3 March" began and
       * ended for them; a bare day would be read as UTC and would put a project
       * created at 00:30 in Madrid into the previous day. See
       * `src/lib/project-date-filter.ts`, which builds these.
       */
      createdFrom?: string;
      createdTo?: string;
    }): Promise<VcaasResponse<VcaasProjectSummary[]>> => {
      const query = new URLSearchParams();
      if (params?.limit != null) query.set("limit", String(params.limit));
      if (params?.skip) query.set("skip", String(params.skip));
      if (params?.search?.trim()) query.set("search", params.search.trim());
      if (params?.sortDirection) query.set("sortDirection", params.sortDirection);
      if (params?.sortField) query.set("sortField", params.sortField);
      if (params?.groupId) query.set("groupId", params.groupId);
      if (params?.createdFrom) query.set("createdFrom", params.createdFrom);
      if (params?.createdTo) query.set("createdTo", params.createdTo);

      const qs = query.toString();
      return proxy.get<VcaasProjectSummary[]>(`${API}/projects${qs ? `?${qs}` : ""}`);
    },

    /** GET /vcaas/projects/{projectId} — full detail for one project. */
    get: (projectId: string): Promise<VcaasResponse<VcaasProject>> =>
      proxy.get<VcaasProject>(project(projectId)),

    /**
     * POST /vcaas/projects — create a project. `projectId` becomes its URL slug.
     *
     * `label` and `groupId` are optional: a project with neither behaves exactly as
     * every project did before they existed.
     */
    create: (body: {
      projectId: string;
      description: string;
      label?: string;
      groupId?: string;
      /** `"v2"` requires the current engine (refused, nothing created, when the account cannot get it). Omitted: the account's default. */
      engineVersion?: "v2" | "legacy";
      /** An export code this new project is about to receive: it is created on that code's engine. */
      sourceImportCode?: string;
    }): Promise<VcaasResponse<VcaasProject>> =>
      proxy.post<VcaasProject>(`${API}/projects`, body),

    /**
     * ═══⭐⭐ POST /vcaas/projects/launch — CREATE AND START BUILDING, IN ONE CALL ══
     *
     * The endpoint the "describe your app" box should use. It creates the project,
     * optionally attaches files / secrets / credit limits / Figma, and STARTS THE AGENT
     * — one round trip instead of create → poll → start, and no window in which a project
     * exists with nothing happening in it.
     *
     * ⚠️⚠️ THE ID YOU ASK FOR IS NOT NECESSARILY THE ID YOU GET. A taken `projectId` is
     * not an error here: upstream appends random characters until one is free and returns
     * the name it actually used, with the one you asked for in `requestedProjectId`.
     * **Always navigate to and call with `data.projectId`.** Assuming your own slug is how
     * you end up talking to somebody else's project — or to nothing at all.
     *
     * ⚠️ `warnings` IS NOT DECORATION. The project can be created while a later step
     * fails: secrets rejected, Figma token refused, an attachment unreadable, or the agent
     * not started at all (`agent.started === false`). Each warning names the endpoint to
     * retry, so a caller that ignores the array reports success for a half-finished launch.
     *
     * ⚠️ `files` ARE BY URL, and they must be fetchable by upstream — a `blob:` URL from
     * the browser is not. Anything the user picked locally has to be uploaded first, which
     * needs a project to exist, which is why the attachment path still creates first.
     *
     * Costs 1 credit for the project, plus the agent run itself.
     */
    launch: (body: {
      projectId: string;
      prompt: string;
      description?: string;
      label?: string;
      groupId?: string;
      files?: { name: string; description?: string; url: string }[];
      secrets?: { secretName: string; secretValue: string; environment?: string }[];
      creditLimits?: {
        maxDevelopmentCreditsPerMonth?: number;
        maxInfrastructureCreditsPerMonth?: number;
      };
      figma?: { token: string };
      /** `"v2"` = the current engine (what this app creates); `"legacy"` only for the legacy database endpoints. */
      engineVersion?: "v2" | "legacy";
      /** Agent tier of the first prompt on the current engine: `"auto"` (default), `"cheap"`, `"normal"`, `"expensive"`. */
      model?: string;
    }): Promise<VcaasResponse<ProjectLaunchResult>> =>
      proxy.post<ProjectLaunchResult>(`${API}/projects/launch`, body),

    /**
     * PATCH /vcaas/projects/{projectId} — change the label, description or group.
     *
     * ⚠️ SEND ONLY WHAT YOU ARE CHANGING. Absent keys are left alone and `null`
     * clears — `{ label: "Acme" }` cannot blank the description, and
     * `{ groupId: null }` takes the project out of its group. Spreading a whole
     * project object in here would overwrite every field with its current display
     * value, which is exactly the failure this contract prevents.
     *
     * ⚠️ `projectId` IS NOT CHANGEABLE — it is the hostname. `label` exists
     * precisely because it cannot be renamed.
     */
    update: (
      projectId: string,
      patch: { label?: string | null; description?: string | null; groupId?: string | null }
    ): Promise<VcaasResponse<{ projectId: string; label?: string; description: string; groupId?: string }>> =>
      proxy.patch(project(projectId), patch),

    /** DELETE /vcaas/projects/{projectId} — permanently delete a project. */
    remove: (projectId: string): Promise<VcaasResponse<unknown>> =>
      proxy.delete(project(projectId)),

    /**
     * POST …/export — package this project's database + a source reference and
     * return a secret `importCode` (Feature H8).
     *
     * ⚠️ COSTS 2 CREDITS, and is rate-limited to **1 per minute / 5 per hour**.
     * A UI that retries on failure without a backoff will trip that limit and
     * turn one error into an hour of them.
     *
     * ⚠️ `includeRecords` DEFAULTS TO FALSE upstream, which exports the schema,
     * pages and config but NOT the rows. We always send it explicitly so the
     * choice is the user's rather than a default nobody saw.
     */
    exportProject: (
      projectId: string,
      body: { includeRecords: boolean }
    ): Promise<VcaasResponse<ProjectExportResult>> =>
      proxy.post<ProjectExportResult>(`${project(projectId)}/export`, body),

    /**
     * POST …/import — restore an `importCode` INTO this project (Feature H8).
     *
     * ⚠️ ASYNC AND DESTRUCTIVE. It returns as soon as the job starts; the
     * restore and rebuild take minutes. Existing data in the target is **always
     * dropped** first, and the target must be nearly empty to begin with (at
     * most 5 tables and 1 version) or upstream answers `PROJECT_NOT_IMPORTABLE`.
     *
     * ⚠️ COSTS 6 CREDITS, same 1/min · 5/hour limit as export.
     */
    importProject: (
      projectId: string,
      body: { importCode: string }
    ): Promise<VcaasResponse<ProjectImportResult>> =>
      proxy.post<ProjectImportResult>(`${project(projectId)}/import`, body),
  },

  // ──────────────────────────── Agent ─────────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/agent/*
  agent: {
    /** GET …/agent/status — current run status + realtime conversation (poll). */
    status: (projectId: string): Promise<VcaasResponse<AgentStatus>> =>
      proxy.get<AgentStatus>(`${project(projectId)}/agent/status`),

    /**
     * GET …/agent/full-conversation — the persisted chat history, WINDOWED.
     *
     * ⚠️ THE PAGING IS OURS, NOT VCAAS'S. Upstream has no cursor: it returns the
     * project's whole `conversation` array, up to a 1000-message hard cap, which on
     * a long-lived project is a multi-megabyte body. Our proxy route slices it
     * server-side before it reaches the browser — see `windowConversation` in
     * `src/app/api/vcaas/[...path]/route.ts` for the whole rationale.
     *
     * ⚠️ THE WINDOW IS COUNTED FROM THE END. `offsetFromEnd: 0` is the live tail;
     * `offsetFromEnd: 120` is the page before it. A skip-from-the-start cursor would
     * shift under the caller whenever the 1000-cap trims the front of the array.
     *
     * ⚠️ OMITTING `limit` KEEPS THE LEGACY BEHAVIOUR — every message, and no
     * `totalCount`/`hasMore` on the response.
     */
    fullConversation: (
      projectId: string,
      options?: { limit?: number; offsetFromEnd?: number }
    ): Promise<VcaasResponse<ConversationHistory>> => {
      const query = new URLSearchParams();
      if (options?.limit !== undefined) query.set("limit", String(options.limit));
      if (options?.offsetFromEnd) query.set("offsetFromEnd", String(options.offsetFromEnd));
      const suffix = query.toString() ? `?${query}` : "";
      return proxy.get<ConversationHistory>(
        `${project(projectId)}/agent/full-conversation${suffix}`
      );
    },

    /** POST …/agent/start — kick off an agent run with a prompt and optional files. */
    start: (
      projectId: string,
      /**
       * ⭐ `model` / `effort` / `fastMode` are OPTIONAL per-run overrides. Totalum's own
       * routing already picks the best model and effort for each prompt, so they are sent
       * only when the user explicitly chose one — see `normalizeRunOptions`. An unusable
       * value never fails the request; upstream drops it and reports it in `warnings`.
       */
      body: { prompt: string; inputFiles: AgentInputFile[] } & AgentRunOptions
    ): Promise<VcaasResponse<unknown>> =>
      proxy.post(`${project(projectId)}/agent/start`, body),

    /** POST …/agent/clear-context — the next prompt starts a fresh agent session. Free. */
    clearContext: (projectId: string): Promise<VcaasResponse<{ message: string }>> =>
      proxy.post(`${project(projectId)}/agent/clear-context`, {}),

    /** POST …/agent/stop — request the current run to stop. */
    stop: (projectId: string): Promise<VcaasResponse<unknown>> =>
      proxy.post(`${project(projectId)}/agent/stop`, {}),

    /** POST …/agent/server/start-or-restart — (re)start the project dev server. */
    restartServer: (projectId: string): Promise<VcaasResponse<unknown>> =>
      proxy.post(`${project(projectId)}/agent/server/start-or-restart`, {}),
  },

  // ───────────────────────── Deployments ──────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/deployments/*
  deployments: {
    /**
     * GET …/deployments/status — production deploy status (poll while deploying).
     *
     * ⚠️ `status` IS NULLABLE, AND IT IS NULL ON EVERY PROJECT THAT HAS NEVER BEEN
     * PUBLISHED — verified against a live project, which answers
     * `{"status":null,"createdAt":null}`. It was typed as a bare `string` here, so a
     * caller checking only for `"success"`/`"error"` polled a null for ever without
     * the type ever hinting that "no deployment at all" was a possible answer.
     */
    status: (projectId: string): Promise<VcaasResponse<DeploymentStatus>> =>
      proxy.get<DeploymentStatus>(`${project(projectId)}/deployments/status`),

    /**
     * POST …/deployments/deploy — publish the project to production.
     *
     * `confirmDestructive` (new engine): run pending migrations that drop data or delete/overwrite rows. Without it
     * such a publish ends `error` with `DESTRUCTIVE_MIGRATION_NEEDS_CONFIRMATION` and nothing changes on live.
     */
    deploy: (projectId: string, confirmDestructive = false): Promise<VcaasResponse<unknown>> =>
      proxy.post(`${project(projectId)}/deployments/deploy`, confirmDestructive ? { confirmDestructive: true } : {}),
  },

  // ──────────────────────────── GitHub ────────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/github/*
  // ⚠️ PAID-PLAN FEATURE — the app gates these behind <PaidFeature>; a free
  // account gets `code: "PLAN_REQUIRED"` back.
  github: {
    /** GET …/github/status — connection + token/branch info. */
    status: (projectId: string): Promise<VcaasResponse<GithubStatus>> =>
      proxy.get<GithubStatus>(`${project(projectId)}/github/status`),

    /** GET …/github/pull-status — status of an in-progress pull/rebuild (poll). */
    pullStatus: (projectId: string): Promise<VcaasResponse<GithubPullStatus>> =>
      proxy.get<GithubPullStatus>(`${project(projectId)}/github/pull-status`),

    /** POST …/github/connect — link a repo with a token and sync direction. */
    connect: (
      projectId: string,
      body: { token: string; repositoryFullName: string; syncDirection: GithubSyncDirection }
    ): Promise<VcaasResponse<GithubConnectResult>> =>
      proxy.post<GithubConnectResult>(`${project(projectId)}/github/connect`, body),

    /** DELETE …/github/connect — unlink the repository (code is untouched). */
    disconnect: (projectId: string): Promise<VcaasResponse<unknown>> =>
      proxy.delete(`${project(projectId)}/github/connect`),

    /** POST …/github/pull — pull the latest changes from GitHub. */
    pull: (projectId: string): Promise<VcaasResponse<GithubPullResult>> =>
      proxy.post<GithubPullResult>(`${project(projectId)}/github/pull`, {}),

    /** GET …/github/env — the dev/prod `.env` contents synced from the repo. */
    env: (projectId: string): Promise<VcaasResponse<GithubEnv>> =>
      proxy.get<GithubEnv>(`${project(projectId)}/github/env`),
  },

  // ─────────────────────────── Figma (Feature H2) ───────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/figma/*
  //
  // ⚠️ NOT a paid-plan feature and NOT metered by the H1 quotas — Figma is a
  // read-only design source the user brings on their own Figma seat. These are
  // absent from `GATED_ROUTES` on purpose.
  figma: {
    /**
     * GET …/figma/status — is Figma connected, and to which account?
     *
     * `verify` re-checks the stored token against Figma's API. Pass it when a
     * modal OPENS, never on a poll: it costs a live Figma call each time.
     */
    status: (projectId: string, verify = false): Promise<VcaasResponse<FigmaStatus>> =>
      proxy.get<FigmaStatus>(`${project(projectId)}/figma/status${verify ? "?verify=true" : ""}`),

    /**
     * POST …/figma/connect — link a Figma account with an access token.
     *
     * The token is validated against Figma before anything is stored, so a
     * failure here is specific ("expired", "wrong scopes") and changes nothing.
     */
    connect: (projectId: string, body: { token: string }): Promise<VcaasResponse<FigmaConnectResult>> =>
      proxy.post<FigmaConnectResult>(`${project(projectId)}/figma/connect`, body),

    /** DELETE …/figma/connect — unlink. Idempotent; your designs are untouched. */
    disconnect: (projectId: string): Promise<VcaasResponse<unknown>> =>
      proxy.delete(`${project(projectId)}/figma/connect`),

    /**
     * ⭐ POST /vcaas/figma/validate — "is this token good?", WITH NO PROJECT.
     *
     * ⚠️ IT CONNECTS NOTHING AND STORES NOTHING, here or upstream. It exists for the
     * dashboard, which offers Figma before the project exists: a design link in the
     * first prompt is useless unless the design can be read, and the same submit
     * that carries the link is what creates the project. The caller validates, lets
     * the project be created, then calls `connect(newProjectId, …)` with the token
     * it is still holding in memory.
     *
     * ⚠️ NO `projectId` IN THE PATH, on purpose — see `validateFigma` in
     * `vcaas.controller.ts`. It is rate-limited per account upstream because it
     * makes an outbound call to a third party with a caller-supplied credential.
     */
    validate: (body: { token: string }): Promise<VcaasResponse<FigmaValidateResult>> =>
      proxy.post<FigmaValidateResult>(`${API}/figma/validate`, body),
  },

  // ──────────────────────────── Secrets ───────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/secrets[/{secretId}]
  secrets: {
    /** POST …/secrets — create an env secret for `development`/`production`/`both`. */
    create: (
      projectId: string,
      body: { secretName: string; secretValue: string; environment: string }
    ): Promise<VcaasResponse<unknown>> =>
      proxy.post(`${project(projectId)}/secrets`, body),

    /** DELETE …/secrets/{secretId} — delete a secret. */
    remove: (projectId: string, secretId: string): Promise<VcaasResponse<unknown>> =>
      proxy.delete(`${project(projectId)}/secrets/${encodeURIComponent(secretId)}`),
  },

  // ──────────────────────── Custom domain ─────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/domain
  // ⚠️ PAID-PLAN FEATURE.
  domain: {
    /** PUT …/domain — attach a custom hostname (project must be deployed first). */
    set: (projectId: string, body: { hostname: string }): Promise<VcaasResponse<unknown>> =>
      proxy.put(`${project(projectId)}/domain`, body),

    /** DELETE …/domain — remove the custom domain. */
    remove: (projectId: string): Promise<VcaasResponse<unknown>> =>
      proxy.delete(`${project(projectId)}/domain`),
  },

  // ─────────────────────────── Versions ───────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/versions[/{versionId}/recover]
  versions: {
    /** GET …/versions?limit=&skip= — paginated version history. */
    list: (
      projectId: string,
      opts: { limit?: number; skip?: number } = {}
    ): Promise<VcaasResponse<{ versions: ProjectVersion[]; totalCount: number }>> => {
      const limit = opts.limit ?? 50;
      const skip = opts.skip ?? 0;
      return proxy.get<{ versions: ProjectVersion[]; totalCount: number }>(
        `${project(projectId)}/versions?limit=${limit}&skip=${skip}`
      );
    },

    /** POST …/versions/{versionId}/recover — restore a past version (costs 2 credits). */
    recover: (projectId: string, versionId: string): Promise<VcaasResponse<unknown>> =>
      proxy.post(`${project(projectId)}/versions/${encodeURIComponent(versionId)}/recover`, {}),

    /**
     * GET …/version-diff?commitSha= — what a version changed, as unified diff text.
     *
     * ⚠️ TEXT, NOT A URL. The chat's diff arrives as a `gitDiffUrl` pointing at
     * signed storage; this one is generated on the sandbox on demand and comes back
     * inline. `DiffViewer` handles both, which is why there is still only one diff
     * implementation.
     *
     * ⚠️ IT NEEDS A RUNNING SANDBOX — the diff is `git diff` on the machine. A
     * sleeping project answers `NO_ACTIVE_SANDBOX`, which the viewer shows as-is.
     */
    diff: (
      projectId: string,
      commitSha: string
    ): Promise<VcaasResponse<{ commitSha: string; diff: string }>> =>
      proxy.get<{ commitSha: string; diff: string }>(
        `${project(projectId)}/version-diff?commitSha=${encodeURIComponent(commitSha)}`
      ),
  },

  /**
   * ────────────────── Project groups ──────────────────
   *
   * Optional folders. ⚠️ NOTHING HERE IS REQUIRED to use the product: every
   * surface must read correctly for an account with no groups at all, which is
   * every account today.
   */
  projectGroups: {
    /** GET /vcaas/project-groups — the account's groups, each with `projectCount`. */
    list: (params?: { search?: string; limit?: number; skip?: number }): Promise<VcaasResponse<ProjectGroup[]>> => {
      const query = new URLSearchParams();
      if (params?.search) query.set("search", params.search);
      if (params?.limit !== undefined) query.set("limit", String(params.limit));
      if (params?.skip !== undefined) query.set("skip", String(params.skip));
      const qs = query.toString();
      return proxy.get<ProjectGroup[]>(`${API}/project-groups${qs ? `?${qs}` : ""}`);
    },

    get: (groupId: string): Promise<VcaasResponse<ProjectGroup>> =>
      proxy.get<ProjectGroup>(`${API}/project-groups/${encodeURIComponent(groupId)}`),

    create: (body: { name: string; description?: string }): Promise<VcaasResponse<ProjectGroup>> =>
      proxy.post<ProjectGroup>(`${API}/project-groups`, body),

    update: (
      groupId: string,
      patch: { name?: string; description?: string }
    ): Promise<VcaasResponse<ProjectGroup>> =>
      proxy.patch(`${API}/project-groups/${encodeURIComponent(groupId)}`, patch),

    /**
     * DELETE /vcaas/project-groups/{groupId}.
     *
     * ⚠️ DELETES THE FOLDER, NOT THE PROJECTS. Its members become ungrouped —
     * `releasedProjects` says how many. Any UI confirming this must say so, or it
     * reads as "delete these N projects".
     */
    remove: (groupId: string): Promise<VcaasResponse<{ deleted: boolean; releasedProjects: number }>> =>
      proxy.delete(`${API}/project-groups/${encodeURIComponent(groupId)}`),
  },

  // ────────────────── Project files (the project-files API) ──────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/files/{tree,content}
  //
  // ⚠️ THE READS ARE FREE, THE WRITE IS NOT. `tree` and `content` (GET) cost
  // nothing on any plan — which is what lets the Code panel open straight into the
  // code instead of behind a "load the archive" gate that spent a credit. `content`
  // (PUT) costs 1 credit and is refused for a free plan upstream
  // (`FREE_PLAN_NO_SOURCE_EDITING`); our catch-all gates it first, as `sourceEdit`.
  //
  // ⚠️ A WRITE DOES NOT GO LIVE. It lands on the sandbox and is committed as a new
  // version, but the running server keeps serving the previous build until a
  // rebuild finishes — hence `rebuildRequired: true` on every write response.
  files: {
    /** GET …/files/tree — every file and folder, flat, sorted, build output excluded. */
    tree: (
      projectId: string,
      params?: { path?: string; limit?: number; offset?: number },
    ): Promise<VcaasResponse<FileTree>> => {
      const query = new URLSearchParams();
      if (params?.path) query.set("path", params.path);
      if (params?.limit != null) query.set("limit", String(params.limit));
      if (params?.offset) query.set("offset", String(params.offset));
      const qs = query.toString();
      return proxy.get<FileTree>(`${project(projectId)}/files/tree${qs ? `?${qs}` : ""}`);
    },

    /** GET …/files/content — one file, up to 1 MB. `FILE_TOO_LARGE` beyond that. */
    content: (projectId: string, path: string): Promise<VcaasResponse<FileContent>> =>
      proxy.get<FileContent>(
        `${project(projectId)}/files/content?path=${encodeURIComponent(path)}`,
      ),

    /**
     * PUT …/files/content — full replace, or create. Up to 512 KB.
     *
     * ⚠️⚠️ THE CONTENT IS SENT AS BASE64, ALWAYS, AND THAT IS NOT AN OPTIMISATION.
     * the Totalum API backend mounts a GLOBAL `sanitize-html` middleware over
     * every request body, and the VCaaS file-write route sits behind it. Source
     * posted as a utf-8 string is parsed as a web page and stripped to a tag
     * allowlist — `className` is not in it, `<script>` is deleted whole — so
     *
     *     PUT <div id="x" className="flex">  →  stored <div>
     *
     * silently corrupts the user's file. Base64 has no `<`, `>` or `&`, so the
     * sanitizer reads it as an ordinary word and passes it through untouched.
     * `encoding: "base64"` is already part of the endpoint's contract and
     * account-backend measures `bytesWritten` on the DECODED length, so nothing
     * else has to know. This was all measured; see
     * `src/app/api/visual-edit/[projectId]/apply/route.ts` for the full note.
     *
     * ⚠️ DO NOT "SIMPLIFY" THIS TO A PLAIN STRING. It will appear to work — the
     * request succeeds — and quietly rewrite people's components.
     */
    write: (
      projectId: string,
      path: string,
      content: string,
    ): Promise<VcaasResponse<FileWriteResult>> =>
      proxy.put<FileWriteResult>(`${project(projectId)}/files/content`, {
        path,
        content: toBase64(content),
        encoding: "base64",
      }),
  },

  // ─────────────────────── Rebuild (the project-files API) ───────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/rebuild[/status]
  //
  // ⚠️ ASYNC UPSTREAM. `POST` returns immediately and the cold build continues for
  // 1-4 minutes; `status` is the only way to know it finished. Costs 1 credit.
  rebuild: {
    /** POST …/rebuild — rebuild and reload so written files go live. */
    start: (projectId: string): Promise<VcaasResponse<{ status: string; startedAt: string }>> =>
      proxy.post<{ status: string; startedAt: string }>(`${project(projectId)}/rebuild`, {}),

    /** GET …/rebuild/status — poll after `start`. `idle` = never rebuilt here. */
    status: (
      projectId: string,
    ): Promise<VcaasResponse<{ status: "idle" | "rebuilding" | "success" | "error"; errorMessage?: string }>> =>
      proxy.get<{ status: "idle" | "rebuilding" | "success" | "error"; errorMessage?: string }>(
        `${project(projectId)}/rebuild/status`,
      ),
  },

  // ──────────────────────────── Logs ──────────────────────────────
  // Final VCaaS endpoints: /vcaas/projects/{id}/backend/{dev,prod}/logs
  //
  // ⚠️⚠️ TWO ENDPOINTS, TWO MACHINES — CORRECTED IN FEATURE F9. Until F9 the
  // comment here (and the Logs panel) claimed the dev endpoint also carried
  // production traffic "because the dev server on PORT 80 serves both". It does
  // not. Read the two upstream handlers and it is unambiguous:
  //   · dev  → totalum-backend `getStartumBackendDevLogs` = `cat
  //            /app/user-project/npm-start.log` ON THE SANDBOX VM.
  //   · prod → totalum-backend `getProdLogs` = a POST to a Cloudflare **Logpush
  //            worker**, because a published project runs on Cloudflare.
  // A user debugging their live site on the dev tab was reading the wrong machine.
  logs: {
    /** GET …/backend/dev/logs — the sandbox dev server's stdout/stderr, as text. */
    dev: (projectId: string): Promise<VcaasResponse<{ logs: string }>> =>
      proxy.get<{ logs: string }>(`${project(projectId)}/backend/dev/logs`),

    /**
     * GET …/backend/prod/logs — the published site's request logs.
     *
     * ⚠️ THE RESPONSE IS A PASSTHROUGH, NOT A TYPE WE OWN. Account-backend declares
     * it `{ [key: string]: any }` and forwards the worker's body verbatim, so it is
     * typed `unknown` here and normalised by `extractProdRecords` in `@/lib/logs`.
     * Claiming `{ logs: string }` (as this entry did before F9, while unused) would
     * have been a lie the compiler happily believed.
     *
     * Query params, all optional and all forwarded verbatim by the catch-all proxy:
     *   · `getOnlyLastLogs` — just the most recent slice. The default when the user
     *     has not asked for anything specific.
     *   · `from` / `to` — ISO 8601. **Only the last 3 days exist upstream.**
     *   · `regexSearch` — a REGEX matched server-side across the whole window; the
     *     only way to find something older than the last slice.
     *
     * Upstream answers `429` when the project's plan log-request limit is reached;
     * that arrives normalised as `RATE_LIMITED`.
     */
    prod: (
      projectId: string,
      params?: { getOnlyLastLogs?: boolean; from?: string; to?: string; regexSearch?: string },
    ): Promise<VcaasResponse<unknown>> => {
      const query = new URLSearchParams();
      if (params?.getOnlyLastLogs !== undefined) {
        query.set("getOnlyLastLogs", String(params.getOnlyLastLogs));
      }
      if (params?.from) query.set("from", params.from);
      if (params?.to) query.set("to", params.to);
      if (params?.regexSearch?.trim()) query.set("regexSearch", params.regexSearch.trim());

      const qs = query.toString();
      return proxy.get<unknown>(`${project(projectId)}/backend/prod/logs${qs ? `?${qs}` : ""}`);
    },
  },

  // ────────────────────────── Webhooks ────────────────────────────
  // Final VCaaS endpoints: /vcaas/webhooks[/{webhookId}]
  //
  // ⚠️ ACCOUNT-SCOPED, NOT PROJECT-SCOPED — the only group here that is. A webhook
  // subscribes to an EVENT for the whole account (`agent.prompt.finished` fires for
  // every project), which is why there is no `projectId` in any of these paths.
  //
  // ⚠️ ONE WEBHOOK PER EVENT. Registering a second URL for an event that already
  // has one returns `WEBHOOK_EVENT_ALREADY_EXISTS` (409); the way to change a URL
  // is delete-then-register. The UI has to say so, because "save" silently doing
  // nothing is the alternative.
  webhooks: {
    /** GET /vcaas/webhooks — every webhook on the account. Free. */
    list: (): Promise<VcaasResponse<{ webhooks: VcaasWebhook[] }>> =>
      proxy.get<{ webhooks: VcaasWebhook[] }>(`${API}/webhooks`),

    /** PUT /vcaas/webhooks — subscribe to one event. HTTPS URLs only. Free. */
    register: (body: {
      url: string;
      event: string;
      headers?: Record<string, string>;
    }): Promise<VcaasResponse<VcaasWebhook>> => proxy.put<VcaasWebhook>(`${API}/webhooks`, body),

    /** DELETE /vcaas/webhooks/{webhookId} — unsubscribe. Free. */
    remove: (webhookId: string): Promise<VcaasResponse<{ deleted: boolean }>> =>
      proxy.delete<{ deleted: boolean }>(`${API}/webhooks/${encodeURIComponent(webhookId)}`),
  },

  /**
   * ═══ v2 PROJECTS ONLY (plan 15 §4, §11) ═══ — every path below exists only for a project whose
   * `engineVersion` is `'v2'`; callers are gated by `isV2Project`. The two database routes of A7.12
   * (`database/sql`, `database/ask`) live here and nowhere else, so a path change (A3.15) is a
   * one-file edit.
   */
  v2: {
    /** PGM's project state (plan 03 §3.2.2); the visual editor reads `preview.versionId`, the version the frame shows. */
    state: (projectId: string) => proxy.get<{ preview?: { versionId?: string } }>(`${project(projectId)}/state`),
    /** The chat's live run timeline, raw: always pass it through `sanitizeRunProgress` before rendering. */
    agentProgress: (projectId: string) => proxy.get<unknown>(`${project(projectId)}/agent/progress`),
    pause: (projectId: string) => proxy.post<{ operation?: { id: string } }>(`${project(projectId)}/pause`, {}),
    resume: (projectId: string) => proxy.post<{ operation?: { id: string } }>(`${project(projectId)}/resume`, {}),
    /** Lifts the emergency stop's pause (free); `released: false` = it was not paused. */
    releaseRunaway: (projectId: string) => proxy.post<{ released: boolean }>(`${project(projectId)}/runaway/release`, {}),
    setLiveHostSuffix: (projectId: string, liveHostSuffix: "totalum-project.com" | "webapp-project.com") =>
      proxy.patch<VcaasProject>(project(projectId), { liveHostSuffix }),

    schema: (projectId: string, env: DbEnv) =>
      proxy.get<SqlSchema>(`${project(projectId)}/database/schema?env=${env}`),
    /** The database Settings view: usage in credits, statistics, the Turso recommendation and tips (free, read-only). */
    databaseUsage: (projectId: string) => proxy.get<DbUsage>(`${project(projectId)}/database/usage`),
    /** A3.19: the one-way D1 → Turso move (fixed credits, a paid plan); PGM refuses during a run or another operation. */
    migrateProvider: (projectId: string) =>
      proxy.post<{ operation: { id: string; estimateSec: number } }>(`${project(projectId)}/database/migrate-provider`, { to: "turso", confirm: projectId }),
    rows: (projectId: string, body: { env: DbEnv; table: string; page: { limit: number; offset?: number }; sort?: { column: string; dir: "asc" | "desc" }[]; search?: string; count?: boolean }) =>
      proxy.post<SqlRows>(`${project(projectId)}/database/rows`, body),
    /**
     * SQL, the question and the system prompt go as base64, like `files.write` above: account-backend's body sanitiser
     * turns `a > 5` into `a &gt; 5` and drops anything shaped like a tag in a plain string.
     */
    sql: (projectId: string, { sql, ...body }: { env: DbEnv; sql: string; params?: (string | number | null)[]; allowWrites?: boolean; confirmLive?: boolean }) =>
      proxy.post<SqlRows>(`${project(projectId)}/database/sql`, { ...body, sql }),
    ask: (projectId: string, { question, ...body }: { env: DbEnv; question: string }) =>
      proxy.post<SqlAskResult>(`${project(projectId)}/database/ask`, { ...body, questionBase64: toBase64(question) }),
    /** Restore points, newest first (A10.7 (3)); `runId` narrows them to one run. */
    bookmarks: (projectId: string, runId?: string) =>
      proxy.get<{ items: DbRestorePoint[] }>(`${project(projectId)}/database/bookmarks${runId ? `?runId=${encodeURIComponent(runId)}` : ""}`),
    /** A10.7 (4): the backups of one database and the 30-day window a time restore may target. */
    backups: (projectId: string, env: DbEnv) =>
      proxy.get<{ backups: DbBackup[]; timeTravel: { availableFrom: string; availableTo: string }; schedule: DbBackupSchedule }>(`${project(projectId)}/database/backups?env=${env}`),
    /** 1 credit; one per 10 minutes (429 `BACKUP_RATE_LIMITED`). */
    createBackup: (projectId: string, env: DbEnv) =>
      proxy.post<{ backupId: string; status: "running" }>(`${project(projectId)}/database/backups`, { env }),
    /** A signed URL to the dump (`.sql`, or `.sql.gz` for a scheduled backup), valid 15 minutes. */
    backupDownload: (projectId: string, backupId: string) =>
      proxy.get<{ url: string; fileName: string }>(`${project(projectId)}/database/backups/${encodeURIComponent(backupId)}/download`),
    /** A10.30, priced as the restore to a time: the backup's dump back into its own database (a backup is taken first). */
    restoreBackup: (projectId: string, backupId: string) =>
      proxy.post<{ operation: { id: string } }>(`${project(projectId)}/database/backups/${encodeURIComponent(backupId)}/restore`, { confirm: projectId }),
    deleteBackup: (projectId: string, backupId: string) =>
      proxy.delete(`${project(projectId)}/database/backups/${encodeURIComponent(backupId)}`),
    /** Free: back to a recorded restore point. Both restores take a restore point first, so another restore undoes them. */
    restoreDatabase: (projectId: string, env: DbEnv, bookmark: string) =>
      proxy.post<{ operation: { id: string } }>(`${project(projectId)}/database/restore`, { env, bookmark, confirm: projectId }),
    /** 2 credits: any minute of the last 30 days. */
    restoreDatabaseToTime: (projectId: string, env: DbEnv, timestamp: string) =>
      proxy.post<{ operation: { id: string } }>(`${project(projectId)}/database/time-travel/restore`, { env, timestamp, confirm: projectId }),
    /** Research 50 P-50.1 (free): the database back to the run's first restore point, then its code without its migrations. */
    undoRun: (projectId: string, runId: string) =>
      proxy.post<{ operation: { id: string }; codeVersionId: string | null }>(`${project(projectId)}/database/undo-run`, { runId, confirm: projectId }),

    /** A6.16, free: one site-analytics read (the query from `analyticsQuery` in `@/lib/site-analytics`). */
    siteAnalytics: (projectId: string, query: string) => proxy.get<SiteAnalyticsAnswer>(`${project(projectId)}/analytics/site?${query}`),

    cronJobs: (projectId: string) => proxy.get<{ items: CronJob[] }>(`${project(projectId)}/cron-jobs`),
    createCronJob: (projectId: string, body: Pick<CronJob, "name" | "schedule" | "request" | "timezone" | "pauseAfterFailures">) =>
      proxy.post<CronJob>(`${project(projectId)}/cron-jobs`, body),
    updateCronJob: (projectId: string, jobId: string, patch: { enabled: boolean } | { pauseAfterFailures: number | null }) =>
      proxy.patch<CronJob>(`${project(projectId)}/cron-jobs/${encodeURIComponent(jobId)}`, patch),
    runCronJob: (projectId: string, jobId: string) =>
      proxy.post<{ executionId: string }>(`${project(projectId)}/cron-jobs/${encodeURIComponent(jobId)}/run`, {}),
    deleteCronJob: (projectId: string, jobId: string) =>
      proxy.delete(`${project(projectId)}/cron-jobs/${encodeURIComponent(jobId)}`),
    /** The job's last runs (30 days), newest first. */
    cronJobRuns: (projectId: string, jobId: string, limit = 20) =>
      proxy.get<{ items: CronRun[]; nextCursor: string | null }>(`${project(projectId)}/cron-jobs/${encodeURIComponent(jobId)}/executions?limit=${limit}`),

    systemPrompt: (projectId: string) =>
      proxy.get<{ systemPrompt: string }>(`${project(projectId)}/agent/system-prompt`),
    setSystemPrompt: (projectId: string, systemPrompt: string) =>
      proxy.put<{ systemPrompt: string }>(`${project(projectId)}/agent/system-prompt`, { systemPromptBase64: toBase64(systemPrompt) }),
    mcpServers: (projectId: string) => proxy.get<{ servers: McpServer[] }>(`${project(projectId)}/agent/mcp-servers`),
    verifyMcpServer: (projectId: string, mcp: McpServerDraft) =>
      proxy.post<{ ok: true; tools: { name: string }[] }>(`${project(projectId)}/agent/mcp-servers/verify`, { mcp }),
    addMcpServer: (projectId: string, mcp: McpServerDraft) =>
      proxy.post<McpServer>(`${project(projectId)}/agent/mcp-servers`, { mcp }),
    setMcpServerEnabled: (projectId: string, mcpId: string, enabled: boolean) =>
      proxy.patch<McpServer>(`${project(projectId)}/agent/mcp-servers/${encodeURIComponent(mcpId)}`, { enabled }),
    removeMcpServer: (projectId: string, mcpId: string) =>
      proxy.delete(`${project(projectId)}/agent/mcp-servers/${encodeURIComponent(mcpId)}`),

    apiKeys: (projectId: string) => proxy.get<{ keys: ProjectApiKey[] }>(`${project(projectId)}/api-keys`),
    createApiKey: (projectId: string, body: { name: string; scopes: string[]; env: ProjectApiKey["env"] }) =>
      proxy.post<{ key: ProjectApiKey & { plaintext: string } }>(`${project(projectId)}/api-keys`, body),
    rotateApiKey: (projectId: string, keyId: string) =>
      proxy.post<{ key: ProjectApiKey & { plaintext: string } }>(`${project(projectId)}/api-keys/${encodeURIComponent(keyId)}/rotate`, {}),
    revokeApiKey: (projectId: string, keyId: string) =>
      proxy.delete(`${project(projectId)}/api-keys/${encodeURIComponent(keyId)}`),
    /** A10.15: a new development preview address; the old one stops at once. */
    rotatePreviewUrl: (projectId: string) =>
      proxy.post<{ temporalLinkUrl: string; rotatedAt: string }>(`${project(projectId)}/preview/rotate-url`, {}),

    /** "day" = today so far, "month" = this calendar month so far (UTC); the API needs the range. */
    usage: (projectId: string | null, query: { env: "all" | "dev" | "live"; groupBy: "day" | "month" }) => {
      const now = new Date();
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), query.groupBy === "day" ? now.getUTCDate() : 1));
      const qs = new URLSearchParams({ ...query, from: from.toISOString(), to: now.toISOString() }).toString();
      return proxy.get<V2Usage>(projectId ? `${project(projectId)}/usage?${qs}` : `${API}/usage?${qs}`);
    },
    limits: (projectId: string) => proxy.get<ProjectLimits>(`${project(projectId)}/limits`),
    setLimits: (projectId: string, features: Partial<Record<FeatureKey, Partial<Pick<FeatureLimit, "enabled" | "monthlyCreditCap" | "monthlyUnitCap">>>>) =>
      proxy.put<ProjectLimits>(`${project(projectId)}/limits`, { features }),
    /** abud: the project's monthly development / infrastructure caps and this month's spend on each. */
    creditLimits: (projectId: string) => proxy.get<ProjectCreditLimits>(`${project(projectId)}/credit-limits`),
    /** The account's projects at a monthly limit this month (one account-level read, never one per project). */
    atLimit: () => proxy.get<AtLimitAnswer>(`${API}/projects/credit-limits/at-limit`),
    /** `PATCH …/credit-limits` (owner only): a positive number, or `null` for no limit. */
    setCreditLimits: (projectId: string, creditLimits: Partial<ProjectCreditLimits["creditLimits"]>) =>
      proxy.patch<Pick<ProjectCreditLimits, "creditLimits">>(`${project(projectId)}/credit-limits`, creditLimits),

    /** One Stripe mode's connected account (plan 11 §9.4); no mode = test. */
    paymentsStatus: (projectId: string, mode: PaymentsMode = "live") =>
      proxy.get<PaymentsStatus>(`${project(projectId)}/payments/status?mode=${mode}`),
    /** Stripe-hosted onboarding of that mode's account; the live one is created with the merchant's `country`. */
    paymentsOnboardingLink: (projectId: string, body: { returnUrl: string; refreshUrl: string; country?: string }, mode: PaymentsMode = "live") =>
      proxy.post<{ url: string; expiresAt: string }>(`${project(projectId)}/payments/onboarding-link?mode=${mode}`, body),
    /** The published site's Stripe mode (owner only); `live` is refused until the live account can take charges. */
    setPaymentsMode: (projectId: string, mode: PaymentsMode) =>
      proxy.put<{ mode: PaymentsMode }>(`${project(projectId)}/payments/mode`, { mode }),
    webhook: (projectId: string) => proxy.get<ProjectWebhook>(`${project(projectId)}/webhook`),
    setWebhook: (projectId: string, url: string | null) => proxy.put<ProjectWebhook>(`${project(projectId)}/webhook`, { url }),
    rotateWebhookSecret: (projectId: string) => proxy.post<{ secret: string }>(`${project(projectId)}/webhook/rotate-secret`, {}),

    mobileBuilds: (projectId: string) => proxy.get<{ builds: MobileBuild[] }>(`${project(projectId)}/mobile/builds`),
    startMobileBuild: (projectId: string, platform: "android" | "ios" = "android") =>
      proxy.post<{ buildId: string }>(
        `${project(projectId)}/mobile/builds`,
        platform === "ios" ? { platform, artifact: "simulator-app" } : { platform, artifact: "debug-apk" },
      ),
    mobileStores: (projectId: string) => proxy.get<MobileStores>(`${project(projectId)}/mobile/stores`),
    storeUploads: (projectId: string) => proxy.get<{ uploads: StoreUpload[] }>(`${project(projectId)}/mobile/store-uploads`),
    startStoreUpload: (projectId: string, buildId: string) =>
      proxy.post<StoreUpload>(`${project(projectId)}/mobile/builds/${encodeURIComponent(buildId)}/store-upload`, {}),
    /** A7.10b: a build still waiting in the Codemagic queue; its reserved credits are given back. */
    cancelMobileBuild: (projectId: string, buildId: string) =>
      proxy.post<MobileBuild>(`${project(projectId)}/mobile/builds/${encodeURIComponent(buildId)}/cancel`, {}),
    mobileBuildDownload: (projectId: string, buildId: string) =>
      proxy.get<{ url: string }>(`${project(projectId)}/mobile/builds/${encodeURIComponent(buildId)}/download`),
    mobileBuildLog: (projectId: string, buildId: string) =>
      proxy.get<{ url: string }>(`${project(projectId)}/mobile/builds/${encodeURIComponent(buildId)}/log`),
    /** Owner-only: connect a store. Google Play takes the Play Console service-account JSON; the App Store reuses the iOS key. */
    connectGooglePlay: (projectId: string, body: { serviceAccountJson: string; packageName: string }) =>
      proxy.put<MobileStores>(`${project(projectId)}/mobile/stores/google-play`, body),
    setIosSigning: (projectId: string, body: { apiKeyP8: string; keyId: string; issuerId: string; bundleId: string }) =>
      proxy.put<{ configured: boolean }>(`${project(projectId)}/mobile/signing/ios`, body),
    connectAppStore: (projectId: string, body: { appAppleId?: string }) =>
      proxy.put<MobileStores>(`${project(projectId)}/mobile/stores/app-store`, body),
    disconnectStore: (projectId: string, store: "google-play" | "app-store") =>
      proxy.delete(`${project(projectId)}/mobile/stores/${store}`),
    /** Owner-only: builds on the owner's own Codemagic account (no shared queue, no build credits). */
    ownBuildKey: (projectId: string) => proxy.get<OwnBuildKey>(`${project(projectId)}/mobile/signing/codemagic`),
    setOwnBuildKey: (projectId: string, apiToken: string) =>
      proxy.put<OwnBuildKey>(`${project(projectId)}/mobile/signing/codemagic`, { apiToken }),
    removeOwnBuildKey: (projectId: string) => proxy.delete(`${project(projectId)}/mobile/signing/codemagic`),
    mobileSettings: (projectId: string) => proxy.get<MobileSettings>(`${project(projectId)}/mobile/settings`),
    setMobileSettings: (projectId: string, body: MobileSettings) =>
      proxy.put<MobileSettings>(`${project(projectId)}/mobile/settings`, body),

    domains: () => proxy.get<{ domains: AccountDomain[] }>(`${API}/domains`),
    searchDomains: (q: string) => proxy.get<{ results: DomainSearchResult[] }>(`${API}/domains/search?q=${encodeURIComponent(q)}`),
    domainContacts: () => proxy.get<{ contacts?: { id: string }[] } | { id: string }[]>(`${API}/domains/contacts`),
    createDomainContact: (contact: Record<string, string>) =>
      proxy.post<{ id: string }>(`${API}/domains/contacts`, { contact }),
    purchaseDomain: (body: { domain: string; contactId: string; expectedPrice: number; projectId?: string; canonicalHost?: string }) =>
      proxy.post<{ domain: AccountDomain }>(`${API}/domains/purchase`, body),
    setDomainAutoRenew: (domainId: string, autoRenew: boolean) =>
      proxy.patch<AccountDomain>(`${API}/domains/${encodeURIComponent(domainId)}`, { autoRenew }),
    /** Attaching again to the same project with another `canonicalHost` moves the site to that prefix (no second fee). */
    attachDomain: (domainId: string, projectId: string, canonicalHost?: string) =>
      proxy.post<AccountDomain>(`${API}/domains/${encodeURIComponent(domainId)}/attach`, canonicalHost ? { projectId, canonicalHost } : { projectId }),
    /** POST …/domains/{id}/detach — the project stops answering on it; the domain stays registered. */
    detachDomain: (domainId: string) =>
      proxy.post<AccountDomain>(`${API}/domains/${encodeURIComponent(domainId)}/detach`, {}),
    dnsRecords: (domainId: string) =>
      proxy.get<{ records: DomainDnsRecord[] }>(`${API}/domains/${encodeURIComponent(domainId)}/dns/records`),
    createDnsRecord: (domainId: string, record: DomainDnsRecordInput) =>
      proxy.post<DomainDnsRecord>(`${API}/domains/${encodeURIComponent(domainId)}/dns/records`, { record }),
    updateDnsRecord: (domainId: string, recordId: string, record: DomainDnsRecordInput) =>
      proxy.patch<DomainDnsRecord>(
        `${API}/domains/${encodeURIComponent(domainId)}/dns/records/${encodeURIComponent(recordId)}`,
        { record },
      ),
    deleteDnsRecord: (domainId: string, recordId: string) =>
      proxy.delete<unknown>(`${API}/domains/${encodeURIComponent(domainId)}/dns/records/${encodeURIComponent(recordId)}`),
    domainForwarding: (domainId: string) =>
      proxy.get<{ forwarding: DomainForward[] }>(`${API}/domains/${encodeURIComponent(domainId)}/forwarding`),
    setDomainForwarding: (domainId: string, forwarding: DomainForward[]) =>
      proxy.put<{ forwarding: DomainForward[] }>(`${API}/domains/${encodeURIComponent(domainId)}/forwarding`, { forwarding }),
    /** Sends name.com's ICANN verification e-mail again, once per pending verification of the contact. */
    resendDomainVerification: (contactId: string) =>
      proxy.post<{ sent: number }>(`${API}/domains/contacts/${encodeURIComponent(contactId)}/resend-verification`, {}),
    /** Charges the saved card now, then renews one year at the registrar. */
    renewDomain: (domainId: string) =>
      proxy.post<{ domain: AccountDomain }>(`${API}/domains/${encodeURIComponent(domainId)}/renew`, {}),
    /** Unlocks the domain and answers its transfer (EPP) code ONCE; it is also e-mailed to the owner. */
    exportDomain: (domainId: string) =>
      proxy.post<{ authCode: string }>(`${API}/domains/${encodeURIComponent(domainId)}/export`, {}),
    cancelDomainExport: (domainId: string) =>
      proxy.post<AccountDomain>(`${API}/domains/${encodeURIComponent(domainId)}/export/cancel`, {}),
  },

  /** GET /vcaas/credit-costs — the fixed price, in credits, of every fixed-price action and monthly fee. Free. */
  creditCosts: (engine: "v2" | "legacy" = "v2"): Promise<VcaasResponse<{ creditCosts: Record<string, number> }>> =>
    proxy.get<{ creditCosts: Record<string, number> }>(`${API}/credit-costs?engine=${engine}`),

  // ─── Non-JSON endpoints (dedicated internal routes, not the catch-all) ───

  /**
   * GET /api/vcaas/git-diff?url=… — fetch a unified git diff.
   *
   * The diff itself lives at a signed storage URL that a conversation message
   * carries (`gitDiffUrl`). The dedicated route downloads it server-side (with an
   * SSRF allow-list) and returns `{ diff }`, so the browser never fetches the
   * external URL directly.
   */
  gitDiff: (url: string): Promise<VcaasResponse<{ diff: string }>> =>
    proxy.get<{ diff: string }>(`${API}/git-diff?url=${encodeURIComponent(url)}`),

  /**
   * GET /api/vcaas/source-code/{projectId} — the project source as an archive.
   *
   * Returns the raw `Response` (not the `{ ok, data }` envelope) because the body
   * is a binary archive the caller streams/decompresses itself. On error the route
   * responds with JSON `{ ok:false, error, code }`; check `content-type`.
   *
   * ⭐ TWO INTENTS, ONE ENDPOINT:
   *
   *   · `intent: "view"` (default) — the read that populates the Code tab.
   *     **Allowed on every plan, Free included.**
   *   · `intent: "download"` — saving the project to disk. **Paid only**; a free
   *     account gets `code: "PLAN_REQUIRED"` from the route, before any credit is
   *     spent.
   *
   * ⚠️ THE DEFAULT IS `view` HERE AND `download` UPSTREAM, on purpose. This client
   * has exactly one legacy caller (the Code panel, which is viewing), whereas
   * totalum-backend has integrations it has never met — so each layer defaults to
   * the safe answer for its own callers. The platform route always sends an
   * explicit intent, so the two defaults never actually meet.
   *
   * ⚠️ EITHER INTENT COSTS 1 CREDIT (`VCAAS_CREDIT_COSTS.GET_SOURCE_CODE`).
   */
  sourceCode: (projectId: string, intent: "view" | "download" = "view"): Promise<Response> =>
    fetch(`${API}/source-code/${encodeURIComponent(projectId)}?intent=${intent}`, {
      cache: "no-store",
    }),

  /**
   * POST /api/vcaas/upload/{projectId} — upload one file (multipart/form-data).
   *
   * Uploads can't use the JSON `proxy` verbs, so this uses raw fetch and returns
   * the parsed envelope. `formData` must contain a `file` field.
   */
  upload: async (
    projectId: string,
    formData: FormData
  ): Promise<VcaasResponse<{ url: string; fileNameId: string }>> => {
    try {
      const res = await fetch(`${API}/upload/${encodeURIComponent(projectId)}`, {
        method: "POST",
        body: formData,
      });
      return (await res.json()) as VcaasResponse<{ url: string; fileNameId: string }>;
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        code: "UNKNOWN",
      };
    }
  },
};
