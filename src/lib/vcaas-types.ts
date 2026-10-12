/**
 * Response and request types for the Totalum API, as consumed by `vcaas.ts`.
 * 📖 The authoritative field-by-field reference: https://www.totalum.app/totalum-api.md
 */
/**
 * VCaaS wire types, kept in step with the API reference so the shapes cannot drift
 * from what the endpoints actually return.
 *
 * ⚠️ THIS APP USES ONE OPERATOR KEY WITH NO LOGIN, so `GET /vcaas/projects` lists
 * every project the key owns. If you put real users behind it (see AGENTS.md
 * "Boilerplate mode"), scope that list to the signed-in user yourself.
 */

export interface VcaasProject {
  projectId: string;
  /**
   * The human name, when the owner has set one — the same field
   * `VcaasProjectSummary.label` carries, returned here so a workspace opened from a
   * deep link knows its own name without paging the whole project list.
   *
   * ⚠️ DISPLAY ONLY; `projectId` is still the identity. See the summary type.
   */
  label?: string;
  /** The group this project is filed under, when any. Most projects have none. */
  groupId?: string;
  description: string;
  plan: string;
  agentProcessStatus?: "init" | "done" | "idle";
  agentServerStatus?: "Active" | "Creating" | "Starting" | "Archived" | "Unarchiving" | "Archiving";
  createdAt: string;
  deployment?: {
    status: "deploying" | "success" | "error";
    createdAt: string;
    versionId?: string;
  } | null;
  /**
   * ⭐ A VERSION RECOVERY IN PROGRESS — `null`/absent when none is running.
   *
   * ⚠️ THIS IS THE CANONICAL SIGNAL, AND THE SERVER SAYS SO. From the VCaaS
   * controller: it is set synchronously before the 200 on `/recover-startum-data-version`
   * and cleared the moment the background work finishes, and the documented way to
   * watch a recovery is *"poll GET /projects/:projectId until `versionRecovery` is
   * null"*. There is no `recover/status` endpoint to poll instead.
   *
   * ⚠️ WHILE IT IS SET, THE SERVER REFUSES agent runs, deploys, restarts and a second
   * recovery with `409 RECOVERY_RUNNING` — a recovery rewrites the project's files on
   * the sandbox and on GCS, and anything else racing that produces inconsistent state.
   * The workspace's own lock mirrors that rule rather than inventing one.
   *
   * ⚠️ `startedAt` COMES FROM THE SERVER, which makes it the one operation whose clock
   * is right in every tab and on every device — see `adopt` in `use-project-operation`.
   */
  versionRecovery?: {
    status: "recovering" | "error";
    versionId: string;
    startedAt: string;
    errorMessage?: string;
  } | null;
  /**
   * ⭐⭐ A PROJECT IMPORT IN PROGRESS — `null`/absent when none is running.
   *
   * ⚠️ IT IS THE CANONICAL SIGNAL, AND THE ONLY REFRESH-PROOF ONE. It reflects
   * totalum-backend's own import lock (`currentImportProcess`), dated by the server
   * that started the work — so a reload, a second tab, another device and an import
   * started from the API or MCP all agree about whether one is running and since
   * when. A browser-local stamp can do none of that, which is why the workspace's
   * blocking import overlay is driven from here.
   *
   * ⚠️ WHILE IT IS SET, PROMPTING IS REFUSED UPSTREAM WITH `IMPORT_IN_PROGRESS` —
   * an import replaces the project's files AND its database wholesale. The
   * workspace's composer lock mirrors that rule rather than inventing one.
   *
   * ⚠️ IT SELF-EXPIRES. account-backend reports `null` once the lock is older than
   * 30 minutes, because a job that died leaves the flag set for ever — so a UI that
   * blocks on this field can never be pinned open. Do not add a longer timeout on
   * this side than upstream's; see `OPERATION_PROFILES.import`.
   *
   * ⚠️ AND IT IS `null` FOR A FAILED IMPORT TOO. The import is over either way; the
   * reason is in the project's conversation. There is no "finished badly" state to
   * render here.
   */
  importInProgress?: {
    startedAt: string;
    errorMessage?: string;
  } | null;
  secrets: VcaasSecret[];
  customDomain?: VcaasDomain | null;
  temporalDevelopmentProjectUrl?: string | null;
  cachedDevelopmentUrl?: string | null;
  developmentUrlFieldToUse?: string | null;
  productionProjectUrl?: string;
  /**
   * A low-resolution screenshot of the project's home page, retaken by
   * account-backend every time a prompt finishes. Absent until the first prompt of
   * a project completes — `ProjectThumbnail` falls back to the project name.
   */
  previewImageUrl?: string | null;
  totalCreditsSpent?: number;
  // ── additive, v2 projects only (plan 15 §1.2; totalum-contracts `GetProjectOutput`). Absent ⇒ legacy. ──
  /** Read it through `engineOf` / `isV2Project` in `project-status.ts`, never directly. */
  engineVersion?: "v2" | null;
  /** The development preview (A4.14): the platform iframes `temporalLinkUrl` (contracts' VCaaS detail calls it `url`). */
  preview?: {
    temporalLinkUrl?: string;
    url?: string;
    deployState?: "idle" | "building" | "deploying" | "failed";
  } | null;
  lifecycle?: { state: VcaasLifecycleState; pausedAt?: string | null; resumable?: boolean } | null;
  /** Contracts carry the pause flat on the detail too (`state`, `pausedAt`, `resumable`). */
  state?: "active" | "paused-by-user";
  pausedAt?: string | null;
  resumable?: boolean;
  /** The emergency stop's pause (contracts `GetProjectOutput.runawayPause`); `value`/`threshold` absent for `usd_hour`. */
  runawayPause?: { pausedAt: string; resumesAt: string; metric: string; value?: number; threshold?: number } | null;
  lastDeployError?: VcaasDeployError | null;
  liveHostSuffix?: "totalum-project.com" | "webapp-project.com";
  busy?: { kind: string; startedAt: string } | null;
  /** PGM's project state: `queued` / `provisioning` until its databases, Worker and sandbox exist, then `ready`. */
  engineState?: string;
  sandbox?: { lastPromptAt?: string | null } | null;
  currentRun?: { runId: string; status: string } | null;
  /** The engine's running or failed operations (pause, resume, restore…), contracts `ProjectState.operations`. */
  operations?: VcaasOperation[];
}

/** Contracts `DbMoveProgress`: a running move to Turso (`kind: 'dbProviderMigration'`), per environment. */
export interface DbMoveProgress {
  phase: "copying" | "verifying" | "switching";
  env: DbEnv;
  copiedBytes: number;
  totalBytes: number;
  etaSec: number;
}

export interface VcaasOperation {
  kind: string;
  id?: string;
  status: "running" | "error";
  startedAt: string;
  errorMessage?: string;
  progress?: DbMoveProgress | Record<string, number>;
}

export type VcaasLifecycleState =
  | "active"
  | "sandbox-archived"
  | "preview-parked"
  | "paused-by-user"
  | "hibernated"
  | "expiring"
  | "deleted";

/** `lastDeployError` on the detail and the payload of a `deploy_error` chat message (A5.14/A5.21). */
export interface VcaasDeployError {
  stage: "migration" | "build" | "upload" | "probe" | (string & {});
  title: string;
  message: string;
  logExcerpt?: string;
  logsUrl?: string;
  fixSummary?: string;
  at?: string;
}

// Shape returned by the "List Projects" endpoint (GET /vcaas/projects).
//
// ⚠️ CORRECTED FOR THIS PLATFORM. The open repo's comment here read "the platform
// is fully open — this lists every project in the account". That is true of a
// single shared static key. On THIS platform the request carries the signed-in
// user's own hidden system key, so VCaaS scopes the list to that account: the
// response contains exactly the caller's projects and nothing else.
/**
 * ⭐ A PROJECT GROUP — an optional folder.
 *
 * ⚠️ MOST PROJECTS ARE IN NONE, and always will be. Every surface has to read
 * correctly for `groupId: undefined`; a group is a lens over the list, never a
 * precondition for seeing a project.
 */
export interface ProjectGroup {
  groupId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  /** How many projects are filed here. Present on list and get, not on create. */
  projectCount?: number;
}

export interface VcaasProjectSummary {
  projectId: string;
  engineVersion?: "v2" | null;
  lifecycleState?: VcaasLifecycleState;
  description: string;
  /**
   * The human name, when the owner has set one. Absent → show `projectId`.
   *
   * ⚠️ `projectId` REMAINS THE IDENTITY. This is display only: every route, every
   * API call and the hostname still use `projectId`, so a label must never be
   * used to look a project up.
   */
  label?: string;
  /** The group this project is filed under, when any. */
  groupId?: string;
  plan: string;
  createdAt: string;
  /**
   * ⭐ WHEN THE PROJECT LAST CHANGED — a prompt, a deploy, a rename, a file edit.
   * Rendered as the "Last modified" column and sortable with `sortField`.
   *
   * ⚠️ OPTIONAL **ONLY** BECAUSE OF DEPLOY ORDER. A current account-backend always
   * sends it (resolved through a fallback chain, so it is never null there); an
   * older one does not send it at all. Read it through `lastModifiedAt()` in
   * `project-sort.ts`, which falls back to `createdAt`, rather than dereferencing
   * it — a dashboard that renders "Invalid Date" against a backend one deploy
   * behind is worse than one that shows the creation date.
   */
  lastModifiedAt?: string;
  /**
   * ⭐ THE THUMBNAIL COMES WITH THE LIST NOW. It is the one piece of card art that
   * used to require a per-project detail call (`use-project-details`) — the list
   * carries it, so a grid of twenty projects draws twenty pictures from one
   * request instead of twenty-one.
   */
  previewImageUrl?: string | null;
  /**
   * How the project was created: `ui` in this app, `api` with a customer's API key.
   * Absent on projects older than the field and on an account-backend that does not
   * send it yet — both read as "not API".
   */
  createdVia?: "ui" | "api";
}

export interface VcaasSecret {
  _id: string;
  secretName: string;
  environment: string;
}

/** One entry of a message's `secretKeysNeeded` map. */
export interface SecretKeyRequest {
  isProvided: boolean;
  /** Why the agent needs it, in its own words. Shown under the key name. */
  description: string;
}

/**
 * Where the hostname is in Cloudflare's custom-hostname lifecycle.
 * `| (string & {})` keeps unknown future values assignable — the UI degrades to
 * "still settling" rather than crashing on a status we have never seen.
 */
export type VcaasDomainStatus =
  | "pending_validation"
  | "pending_deployment"
  | "active"
  | "blocked"
  | "pending_deletion"
  | (string & {});

/** Certificate progress. Moves INDEPENDENTLY of `status` — see `@/lib/domain-status`. */
export type VcaasDomainSslStatus =
  | "initializing"
  | "authorizing"
  | "issuing"
  | "active"
  | "expired"
  | "timing_out"
  | "validation_timed_out"
  | (string & {});

export interface VcaasDomain {
  hostname: string;
  status: VcaasDomainStatus;
  sslStatus: VcaasDomainSslStatus;
  dnsRecordsToAdd?: DnsRecord[];
  /**
   * When the domain was attached. Sent by VCaaS (`GetDomainOutput.createdAt`) and
   * the only way to say "waiting 12 min" instead of an unanchored spinner — a
   * clock started at mount is wrong after every reload, and DNS outlives reloads.
   */
  createdAt?: string;
  updatedAt?: string;
  /** New engine: `purchase` = registered through Totalum, which sets its records itself (SP19). */
  source?: "manual" | "purchase";
  /** New engine: where the site answers — `www`, `app`, any label, or `apex`; null for a subdomain. */
  canonicalHost?: string | null;
  /** New engine: each address with its own status — the site and the bare domain that redirects to it. */
  hostnames?: VcaasDomainHostname[];
  /** New engine: the bought domain (`GET /domains`) this is, when it was bought on Totalum. */
  accountDomainId?: string;
}

export interface VcaasDomainHostname {
  hostname: string;
  /** `canonical` = where the site answers; `alias` = redirects (301) to it; `sub` = a connected subdomain. */
  role: "canonical" | "alias" | "sub";
  status: VcaasDomainStatus;
  sslStatus: VcaasDomainSslStatus;
  dnsRecordsToAdd?: DnsRecord[];
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
}

export interface AgentInputFile {
  name: string;
  url: string;
  imageDescription: string;
}

/** Claude model alias for a run (`POST /agent/start` → `model`). `opus` is the default. */
export type AgentModel = "opus" | "sonnet";
/** v2 run tier (A5.7, A10.10): cheap, normal, expensive; `auto` (automode): the engine picks one per prompt. */
export type AgentModelTier = "cheap" | "normal" | "expensive" | "auto";
/** Claude Code effort level (`POST /agent/start` → `effort`). Absent = Claude Code default. */
export type AgentEffort = "low" | "medium" | "high" | "xhigh";

/** Optional per-run options; only the keys the user actually chose are sent. */
export interface AgentRunOptions {
  model?: AgentModel;
  /** v2 projects only (A5.7/A5.31): sent instead of `model`. */
  modelTier?: AgentModelTier;
  effort?: AgentEffort;
  /** Claude Code fast mode — Opus only, ignored with `sonnet`. */
  fastMode?: boolean;
}

export interface ConversationMessage {
  author: "user" | "agent";
  message: string;
  messageType: "regular" | "starting" | "building" | "finished" | "error" | "limit-reached";
  createdAt: string;
  versionId?: string;
  /**
   * Keys the agent stopped and asked for, by name. Rendered as an inline form in
   * the chat — see `SecretsRequest.tsx`.
   *
   * ⚠️ `isProvided` IS EFFECTIVELY ALWAYS `false` HERE. It is written when the
   * agent asks and the endpoint that flips it (`update-secret-key-provided-state`)
   * is only ever called by the legacy Angular app. Treat it as one input to
   * "already set", never as the answer — the project's own secret list is what
   * tells you the truth.
   */
  secretKeysNeeded?: Record<string, SecretKeyRequest>;
  gitDiffUrl?: string;
  /** automode: an `auto` run's final message names the tier that ran. */
  autoMode?: boolean;
  modelUsed?: "cheap" | "normal" | "expensive";
  /**
   * refusedmsg: a prompt the API refused (no run) and the refusal's text, kept in the conversation — the user's message
   * and an `error` reply, rendered apart from runs.
   */
  refused?: boolean;
  /** v2 system messages (`deploy_error`, …): rendered by kind, unknown kinds fall back to plain text. */
  meta?: ({ kind: string } & Partial<VcaasDeployError>) | null;
  /**
   * What the API persists for a user message's attachments (echoed by
   * `agent/full-conversation`). ⚠️ Its strings are HTML-escaped upstream (`&amp;`
   * in signed URLs → 403), so read it only through `rehydrate` in `use-agent-run.ts`.
   */
  files?: AgentInputFile[];
  // Attachments normalised for rendering — this session's uploads, or `files`
  // decoded. This is what the chat bubble reads.
  inputFiles?: AgentInputFile[];
}

/**
 * A WINDOW onto the persisted chat history — see `vcaasApi.agent.fullConversation`
 * and the long note on `windowConversation` in the VCaaS catch-all proxy.
 *
 * ⚠️ `totalCount` / `hasMore` ARE ABSENT ON AN UN-WINDOWED CALL. Asking for no
 * `limit` returns the legacy shape (every message, no meta), so both fields are
 * optional and a consumer must treat `undefined` as "the whole thing".
 */
export interface ConversationHistory {
  conversation: ConversationMessage[];
  /** Messages the project holds upstream, across every page. */
  totalCount?: number;
  /** Older messages exist BEFORE this window. */
  hasMore?: boolean;
}

export interface AgentStatus {
  projectId: string;
  status: "init" | "done" | "idle";
  startedAt: string | null;
  realtimeConversation: ConversationMessage[];
  creditsSpent?: number;
  /** The engine's estimate for the current run, whole minutes — an approximation, never a deadline. `null` when none. */
  expectedMinutes?: number | null;
  /** ISO date = `startedAt` + `expectedMinutes`; `null` when there is no estimate. */
  expectedFinishAt?: string | null;
  /** v2: the running run, else the last one. */
  runId?: string;
}

/**
 * ═══ THE PROJECT FILE API (Feature F11) ═════════════════════════════════════
 *
 * `files/tree` and `files/content` (GET) are FREE on every plan; `files/content`
 * (PUT) costs a credit and is refused for a free plan upstream. The Code panel is
 * built on all three — see `vcaasApi.files`.
 */
export interface FileTreeEntry {
    /** Root-relative, e.g. `src/app/page.tsx`. */
    path: string;
    name: string;
    type: "file" | "folder";
    /** Bytes. Files only. */
    size?: number;
    /** 0 at the project root. */
    depth: number;
}

export interface FileTree {
    entries: FileTreeEntry[];
    totalEntries: number;
    offset: number;
    limit: number;
    hasMore: boolean;
    commitSha: string | null;
    filesCount: number;
}

export interface FileContent {
    path: string;
    name: string;
    size: number;
    /** `base64` when the file has a NUL byte in its first 8 KB — i.e. it is binary. */
    encoding: "utf8" | "base64";
    content: string;
    commitSha: string | null;
}

export interface FileWriteResult {
    path: string;
    /** `false` (with `202`) while the engine has accepted the save but not committed it yet — see `confirmSaved`. */
    saved?: boolean;
    bytesWritten: number;
    created: boolean;
    commitSha?: string;
    filesCount?: number;
    /** Always true. The running server keeps serving the old build until a rebuild. */
    rebuildRequired: boolean;
}

export interface ProjectVersion {
  _id: string;
  name: string;
  /**
   * The git commit this version points at.
   *
   * ⚠️ IT IS THE ONLY WAY TO GET A DIFF FOR A VERSION, and it was missing from
   * this type even though `GET /versions` has always returned it. Without it the
   * versions list had nothing to ask for changes with, so it fell back to
   * `commitMessage` — a human sentence — and passed it where a URL was expected.
   * Absent on very old versions, which stored a `files[]` snapshot instead of a
   * commit; those genuinely have no diff.
   */
  commitSha?: string;
  /** A commit MESSAGE. Not a URL, and never a diff — see `commitSha`. */
  commitMessage?: string;
  prompt?: string;
  createdAt: string;
}

export interface DbTable {
  _id: string;
  type: string;
  label: string;
  description: string;
  icon: string;
  properties: Record<string, DbProperty>;
}

export interface DbProperty {
  /**
   * ⚠️ NOT UNIQUE ACROSS TABLES — and that is load-bearing, not a defect.
   * The two sides of one relation share the SAME `id`: `user.session`
   * (oneToMany) and `session.user_id` (manyToOne) are both `neMm6_d9px0o`.
   * Verified against a live Totalum schema. It is how the inverse side of a
   * relation is found (see `pairedPropertyId` in `@/lib/totalum-schema`).
   */
  id: string;
  name: string;
  /**
   * The RAW Totalum type: `string` · `number` · `date` · `long-string` ·
   * `options` · `file` · `objectReference` · `boolean`.
   *
   * ⚠️ THIS IS NOT THE USER-FACING TYPE LIST. The docs speak of `longString`,
   * `multipleFile`, `multipleOptions` and `tableLink`; none of those are
   * `propertyType` values. `multipleFile` is `file` with
   * `typeExtras.file.multiple`, `multipleOptions` is `options` with
   * `typeExtras.optionsConfig.multiple`, and `tableLink` is `objectReference`.
   * Use `fieldKindOf()` from `@/lib/totalum-schema` — never switch on this
   * directly.
   */
  propertyType: string;
  label: string;
  description?: string;
  /**
   * ⚠️ CORRECTED IN FEATURE H3. This was typed `{ tableTo, type }`, which the
   * API has never sent — so every read of it was `undefined` and the schema view
   * silently showed no link target for any relation. The real shape, confirmed
   * against a live schema and `data-structure.interface.ts` in totalum-backend:
   *
   * `objectReferenceTypeId` is the **`_id` of the target table's structure**,
   * not its `type` name.
   */
  objectReference?: {
    objectReferenceTypeId?: string;
    objectReferenceRelation?: "manyToMany" | "oneToMany" | "manyToOne" | "oneToOne";
  } | null;
  typeExtras?: Record<string, unknown> | null;
  /** Totalum's own "use this as the display field" hint. Drives `labelForRecord`. */
  showInTree?: boolean | null;
}

// ─── GitHub integration ───
// ─────────────────── Project transfer (Feature H8) ───────────────────

/**
 * What `POST …/export` hands back.
 *
 * ⚠️ `importCode` IS A SECRET AND A BEARER CREDENTIAL. Anyone holding it can
 * import this project's database and source into a project of their own. Treat
 * it like a token: never log it, never put it in a URL, never render it into a
 * page that could be screenshotted casually without the user asking to see it.
 */
export interface ProjectExportResult {
  importCode: string;
  includeRecords: boolean;
  message?: string;
}

/**
 * What `POST …/import` hands back. **It returns immediately** — the restore and
 * rebuild run in the background for minutes afterwards, so `status` is always
 * `"importing"` and the caller must poll the project.
 */
export interface ProjectImportResult {
  projectId: string;
  status: string;
  message?: string;
}

// ─────────────────────────── Figma (Feature H2) ───────────────────────────

/**
 * The Figma account a project is linked to.
 *
 * ⚠️ IDENTITY ONLY. No type in this file carries a Figma token, and none should:
 * the token goes up in a request body and is never sent back down.
 */
export interface FigmaAccount {
  id: string;
  /** Display name — Figma calls this `handle`. */
  handle: string;
  email?: string;
  imgUrl?: string;
}

export interface FigmaStatus {
  connected: boolean;
  account?: FigmaAccount;
  connectedAt?: string;
  /** Only present when the status was requested with `verify: true`. */
  tokenValid?: boolean;
  /** Why the live re-check failed, when it did. */
  tokenError?: string;
}

export interface FigmaConnectResult {
  connected: boolean;
  account: FigmaAccount;
}

/**
 * `POST /vcaas/figma/validate` — the token is real and the account it belongs to.
 *
 * ⚠️ `valid` IS NOT `connected`. Nothing was stored and no project was touched; the
 * caller is holding a token it has now proved works. See `vcaasApi.figma.validate`.
 */
export interface FigmaValidateResult {
  valid: boolean;
  account?: FigmaAccount;
}

export interface GithubStatus {
  connected: boolean;
  tokenValid: boolean;
  tokenExpired: boolean;
  repositoryFullName?: string;
  developBranch?: string;
  productionBranch?: string;
}

export type GithubSyncDirection = "totalum_to_github" | "github_to_totalum";

export interface GithubConnectResult {
  connected: boolean;
  repositoryFullName: string;
  syncAction: "push_new" | "push" | "pull" | "merge_and_push" | "already_synced";
  repoHasContent: boolean;
  requiresRebuild: boolean;
}

export interface GithubPullResult {
  status: "pulling" | "no_changes";
  message: string;
  filesUpdated: number;
}

export interface GithubPullStatus {
  status: "pulling" | "success" | "error" | null;
  createdAt?: string;
}

export interface GithubEnv {
  envDev: string;
  envProd: string;
}

/**
 * A registered webhook subscription (`GET /vcaas/webhooks`).
 *
 * ⚠️ ACCOUNT-SCOPED — there is no `projectId`. `event` is one of
 * `WEBHOOK_EVENTS` in `lib/api-reference/concepts.ts`, kept as a plain `string`
 * here so an event added upstream does not make an existing row fail to type.
 */
export interface VcaasWebhook {
  id: string;
  url: string;
  event: string;
  headers?: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
}

// ─────────────── v2 project sub-resources (plan 15 §4, §11; shapes from totalum-contracts where it has them) ───────────────

export type DbEnv = "dev" | "live";

/** `GET …/database/backups?env=` item (contracts `DbBackup`), newest first. */
export interface DbBackup {
  id: string;
  env: DbEnv;
  /** `daily` / `weekly` / `monthly`: the scheduled backups of the live database on a paid plan (A10.30). */
  kind: "manual" | "pre_restore" | "pre_delete" | "daily" | "weekly" | "monthly";
  status: "running" | "complete" | "failed";
  createdAt: string;
  /** When a scheduled backup is deleted; `null` for the others. */
  expiresAt: string | null;
  sizeBytes: number | null;
  bookmark: string | null;
  error?: string;
}

/** `GET …/database/backups` `schedule` (contracts `DbBackupSchedule`): the live database's scheduled backups. */
export interface DbBackupSchedule {
  enabled: boolean;
  frequency: "daily" | "weekly";
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: "complete" | "skipped_unchanged" | "failed" | null;
  lastBackupAt: string | null;
  lastError?: string;
  /** Days, weeks and months each kind is kept; `null` on the free plan. */
  retention: { daily: number; weekly: number; monthly: number } | null;
}

/** A Turso reason or a tip of `GET …/database/usage`: a code (translated by the UI), its figures, English words. */
export interface DbUsageReason {
  code: string;
  message: string;
  params?: Record<string, string | number>;
}
interface DbUsageCredits {
  rowsRead: number;
  rowsWritten: number;
  storage: number;
  total: number;
}
export interface DbUsageEnv {
  env: DbEnv;
  provider: "d1" | "turso";
  region: string | null;
  readReplicas: boolean;
  sizeBytes: number | null;
  lastBackupAt: string | null;
  usage: Record<"today" | "last7Days" | "last30Days", { rowsRead: number; rowsWritten: number; credits: DbUsageCredits }>;
  daily: { date: string; rowsRead: number; rowsWritten: number; requests: number; credits: DbUsageCredits; sizeBytes: number | null }[];
  /** `estimated`: a table over 100,000 rows is not counted row by row; its figure is approximate. */
  tables: { count: number; rows: number | null; list: { name: string; rows: number | null; estimated?: boolean }[] } | null;
  queries: { sql: string; count: number; totalMs: number; rowsRead: number; rowsReturned: number; rowsWritten: number }[] | null;
}
/** `GET …/database/usage` (totalum-accounts): the database Settings view, in credits only. */
export interface DbUsage {
  generatedAt: string;
  envs: DbUsageEnv[];
  turso: {
    verdict: "recommended" | "consider" | "not_needed" | "on_turso";
    reasons: DbUsageReason[];
    /** What changes on Turso for a database over 1 GB: shown before the user confirms the move. */
    caveats?: DbUsageReason[];
    location: string;
    envs: DbEnv[];
    estimateSec: number;
    databaseBytes: number;
    credits: number;
    paidPlanRequired: boolean;
  };
  tips: (DbUsageReason & { env: DbEnv; severity: "warn" | "info" })[];
}

/** `GET …/database/schema?env=` (contracts `VcaasDbSchemaOutput`). */
/** `GET …/database/schema?env` — SDK-API's PRAGMA-derived schema (contracts `DbSchemaTable`). A missing dev database answers `404 DEV_DATABASE_NOT_FOUND`. */
export interface SqlSchema {
  env: DbEnv;
  tables: SqlTable[];
  /** Drizzle's `_migrations` ledger: how many migrations are applied, and the last one. */
  ledger?: { count: number; lastCreatedAt: number | null; lastHash: string | null };
}

export interface SqlTable {
  name: string;
  label: string;
  /** `system` = auth, migrations and other tables the app does not own. */
  kind: string;
  rowCount?: number;
  /** `unique` = unique on its own; a column of a composite primary key is not (it is unique only with the others). */
  columns: { name: string; sqlType: string; kind: string; label: string; notNull: boolean; unique: boolean; default: string | null; options?: string[] }[];
  /** The primary key's columns in key order; `[]` = none. */
  primaryKey?: string[];
  foreignKeys: { column: string; table: string; toColumn: string; onDelete: string }[];
  ui?: { hidden?: boolean; displayColumn?: string };
}

/** `POST …/database/rows` and `POST …/database/sql` both answer rows as objects keyed by column. */
export interface SqlRows {
  columns: { name: string }[];
  rows: Record<string, unknown>[];
  nextAfter?: string;
  total?: number;
  truncated?: boolean;
  meta?: { duration?: number; rows_read?: number; rows_written?: number; changes?: number };
}

/** `POST …/database/ask` (A7.12): the SQL is shown, never auto-run. */
export interface SqlAskResult {
  sql: string;
  explanation?: string;
  isReadOnly: boolean;
  model?: string;
  creditsCharged?: number;
}


/** `GET …/cron-jobs` item (plan 15 §4.5). */
export interface CronJob {
  id: string;
  name: string;
  /** A 5-field UTC cron expression or `{ everyMinutes }` (contracts `CronSchedule`). */
  schedule: string | { everyMinutes: number };
  request: { method: "GET" | "POST"; url: string };
  enabled: boolean;
  status: "active" | "paused" | "paused_failures";
  nextRunAt: string | null;
  /** `status` is the HTTP status of the fired request, or `timeout` / `error` / `skipped`. */
  lastRun?: { at: string; status: number | "timeout" | "error" | "skipped"; latencyMs: number };
  /** `live` fires at the published app, `dev` at the preview (contracts `CronJob.env`). */
  env?: "live" | "dev";
  /** cron2: the IANA zone `schedule` is read in (absent = UTC). */
  timezone?: string;
  /** cron2: failed runs in a row that pause it (default 3); `null` = never. */
  pauseAfterFailures?: number | null;
}

/** `GET …/cron-jobs/:jobId/executions` item (contracts `CronRun`, 30 days). */
export interface CronRun {
  id: string;
  scheduledFor: string;
  startedAt: string | null;
  status: number | "timeout" | "error" | "skipped";
  latencyMs: number | null;
  error?: string;
  responseSnippet?: string;
}

/** `GET …/agent/mcp-servers` item (contracts `McpServer`; header values are write-only). */
export interface McpServer {
  id: string;
  name: string;
  transport: "http" | "sse";
  url: string;
  headerNames?: string[];
  enabled: boolean;
  verifiedAt?: string;
  tools: string[];
}

/** `GET …/api-keys` item — a project key (`tlm_pk_`, A6.1), not an account key. */
export interface ProjectApiKey {
  id: string;
  name: string;
  prefix?: string;
  last4?: string;
  scopes: string[];
  env: "live" | "dev" | "both";
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  /** Totalum's own keys: `app` runs the preview and live Workers, `env` is the one in the downloaded `.env` files. */
  managed?: "app" | "env";
}

/** The frozen 13 feature keys of A6.34, in display order. */
/** Display order of `GET …/limits` `features` (A6.34, A6.45): the total first, AI and its sub-features together. */
export const FEATURE_KEYS = [
  "all", "ai", "ai_text", "ai_image", "ai_video", "speech", "web", "browser", "scan", "storage", "email", "pdf",
  "vectors", "realtime", "cron", "mobile", "database", "worker",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface FeatureLimit {
  enabled: boolean;
  monthlyCreditCap?: number | null;
  monthlyUnitCap?: number | null;
  unit?: string;
  consumed?: { credits: number; units: number };
  planCeiling?: { monthlyCreditCap: number | null; monthlyUnitCap: number | null };
  source?: "plan" | "user" | "ceo";
  /** A6.45: `ai` for the AI sub-features. */
  parent?: string;
}

/** `GET …/limits` — only the A6.34 per-feature block is read here. */
/** abud: `GET /vcaas/projects/:id/credit-limits` (v2): the monthly caps (null = no limit) and this UTC month's spend. */
export interface ProjectCreditLimits {
  creditLimits: { maxDevelopmentCreditsPerMonth: number | null; maxInfrastructureCreditsPerMonth: number | null };
  usedThisMonth: { development: number; infrastructure: number } | null;
}

/**
 * `GET /vcaas/projects/credit-limits/at-limit` (totalum-accounts, v2): the account's projects that reached a monthly
 * limit this UTC month, from one account-level read; `canEdit` = this actor may raise them (the owner's PATCH rule).
 */
export interface AtLimitProject {
  projectId: string;
  label: string | null;
  createdVia: "api" | "ui" | null;
  creditLimits: ProjectCreditLimits["creditLimits"];
  usedThisMonth: { development: number; infrastructure: number };
  atLimit: { development: boolean; infrastructure: boolean };
}
export interface AtLimitAnswer {
  projects: AtLimitProject[];
  resetsAt: string;
  canEdit: boolean;
}

export interface ProjectLimits {
  features: Partial<Record<FeatureKey, FeatureLimit>>;
  limitScope?: "account" | "project";
}

/** One refusal a cap or a switch caused (A6.34: listed on the usage response). */
export interface FeatureRefusal {
  at: string;
  feature: string;
  code: "FEATURE_LIMIT_REACHED" | "FEATURE_DISABLED";
  env?: DbEnv;
  count?: number;
}

/** `GET …/usage` / `GET /vcaas/usage` — read loosely: every dimension the server returns is shown as-is. */
export interface V2Usage {
  totals?: { credits?: number; byDimension?: Record<string, { units?: number; credits?: number; unit?: string }> };
  refusals?: FeatureRefusal[];
  byProject?: { projectId: string; label?: string; engineVersion?: string; totals?: { credits?: number } }[];
}

/** `GET …/mobile/builds` item (contracts `MobileBuildView`). */
export interface MobileBuild {
  id: string;
  platform: "android" | "ios";
  status: "queued" | "running" | "success" | "failed" | "cancelled";
  /** A7.10b: waiting for a Codemagic slot (one build at a time for everyone): its place in the queue. */
  queuePosition?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  artifact?: { type: string; sizeBytes: number; expiresAt: string } | null;
  signed?: boolean;
  /** `publish`: started by "send to stores on publish" (A7.10 amendment 2026-09-28). */
  trigger?: "user" | "publish";
  /** A failed build keeps its log's last lines; the full log is behind `mobileBuildLog`. */
  error?: { code: string; message: string; logExcerpt?: string };
  hasLog?: boolean;
}

/** `GET|PUT /vcaas/projects/:id/mobile/settings` (owner-only). */
/** `GET|PUT /vcaas/projects/:id/mobile/signing/codemagic`: the owner's own Codemagic API key — never returned, only its last 4 characters. */
export interface OwnBuildKey {
  configured: boolean;
  tokenHint: string | null;
  addedAt: string | null;
}

export interface MobileSettings {
  sendToStoresOnPublish: boolean;
}

/** `GET /vcaas/projects/:id/mobile/stores` (contracts `StoresView`): metadata only. */
export interface MobileStores {
  googlePlay: { clientEmail: string; packageName: string; packageFound: boolean; validatedAt: string } | null;
  appStore: { appAppleId: string; bundleId: string; validatedAt: string } | null;
}

/** A store upload (contracts `StoreUploadView`): Google Play internal track or TestFlight. */
export interface StoreUpload {
  id: string;
  buildId: string;
  store: "google-play" | "app-store";
  track: "internal" | "testflight";
  status: "queued" | "uploading" | "processing" | "success" | "failed" | "manual_required";
  versionName: string;
  versionCode: number;
  consoleUrl: string | null;
  error?: { code: string; message: string };
  createdAt: string;
  finishedAt: string | null;
}

/** `GET /vcaas/domains` item (contracts `Domain`, trimmed to what the page shows). */
export interface AccountDomain {
  id: string;
  domain: string;
  status: string;
  expiresAt: string;
  autoRenew: boolean;
  attachedProjectId?: string;
  /** Where the attached site answers: `www` (default), `app`, any DNS label, or `apex` (the bare domain). */
  canonicalHost?: string;
  pricing?: { renewalPriceEstimate: number; currency: string };
  /** ICANN's 60-day transfer lock ends here (plan 22 §3.6). */
  exportAvailableAt?: string;
  contactId?: string;
  /** ICANN registrant verification (plan 22 §3.2): pending until the owner clicks name.com's e-mail; `verifyBy` = its deadline. */
  verification?: { contactVerificationPending: boolean; verifyBy: string | null };
}

/** A DNS record at the registrar; `managed` = written by Totalum for an attached project (read-only). */
export interface DomainDnsRecord {
  id: string;
  type: "A" | "AAAA" | "CNAME" | "ALIAS" | "MX" | "TXT" | "SRV" | "NS";
  host: string;
  answer: string;
  ttl: number;
  priority?: number;
  managed: boolean;
}
export type DomainDnsRecordInput = Omit<DomainDnsRecord, "id" | "managed">;

/** URL forwarding at the registrar (plan 22 §3.4); `PUT …/forwarding` replaces the whole set. */
export interface DomainForward {
  host: string;
  forwardsTo: string;
  type: "redirect" | "302" | "masked";
}

export interface DomainSearchResult {
  domain: string;
  available: boolean;
  price: number;
  renewalPrice: number;
  currency: string;
}

/**
 * ⭐ The answer from `POST /projects/launch` — see `vcaasApi.projects.launch`.
 *
 * ⚠️ `projectId` MAY DIFFER FROM THE ONE REQUESTED (a taken name is resolved, not
 * refused), and `warnings` reports the steps that did not happen even though the project
 * itself was created. Both are the reason this is a shape rather than a bare id.
 */
export interface ProjectLaunchResult {
  projectId: string;
  /** Present only when the requested id was taken and upstream picked another. */
  requestedProjectId?: string;
  agent: {
    started: boolean;
    status?: string;
    message?: string;
  };
  /** `{ step, errorCode, errorMessage }` per step that did not happen (`message`/`endpoint` on older answers). */
  warnings?: { step?: string; errorCode?: string; errorMessage?: string; message?: string; endpoint?: string }[];
}
