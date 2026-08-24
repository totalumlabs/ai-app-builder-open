/**
 * VCaaS wire types — copied verbatim from `ai-app-builder-open/src/lib/vcaas-types.ts`
 * so the shapes cannot drift from the API they describe.
 *
 * ⚠️ ONE COMMENT IN HERE IS WRONG FOR THIS PLATFORM and is corrected inline below:
 * the open repo is "fully open" with a single static key, so its `GET /vcaas/projects`
 * really does list every project in one shared account. Here the key is the
 * per-user SYSTEM key (CONTEXT §7.5), so the same endpoint returns only the
 * signed-in user's projects. That difference is the whole ownership model — see
 * `src/lib/vcaas.ts` and PROGRESS Phase 06 → "Ownership".
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
  // Files the user attached to this message. Client-side only (the VCaaS
  // conversation API does not echo attachments back), used to render the
  // attachment chips/thumbnails on the user's chat bubble.
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
  warnings?: { step?: string; message?: string; endpoint?: string }[];
}
