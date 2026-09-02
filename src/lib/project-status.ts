import type { StatusTone } from "@/components/primitives";
import type { VcaasProject } from "@/lib/vcaas-types";
import type { TranslationKey } from "@/i18n";

/**
 * Derive ONE user-facing status from VCaaS's several independent status fields.
 *
 * A project detail carries three signals that can all be set at once:
 *
 *   `agentProcessStatus`  "init" | "done" | "idle"      — is the agent working?
 *   `agentServerStatus`   "Active" | "Creating" | "Starting" | "Archived" |
 *                         "Unarchiving" | "Archiving"   — is the sandbox VM up?
 *   `deployment.status`   "deploying" | "success" | "error" — is it published?
 *
 * The dashboard shows one pill, so they need an ORDER OF PRECEDENCE. We answer the
 * question the user is actually asking — "what is happening to my app right now?" —
 * so IN-FLIGHT work outranks steady state:
 *
 *   1. building   — the agent is mid-run (`init`), or the VM is coming up.
 *                   This is the only state where something is actively changing.
 *   2. deployed   — published and live (`deployment.status === "success"`).
 *                   ⚠️ This is the ONLY state in which `projectId.totalum-project.com`
 *                   serves anything, which is why the production link is gated on it
 *                   (`isPublished` below) rather than on the URL merely existing.
 *   3. running    — sandbox Active, not published. The preview works; the world
 *                   can't see it yet.
 *   4. stopped    — archived / archiving. The VM is down; opening it wakes it.
 *   5. failed     — the last deployment errored and nothing newer succeeded.
 *   6. pending    — we have no detail yet (the list endpoint doesn't return any of
 *                   these fields), or nothing above matched.
 *
 * ⚠️ THE LIST ENDPOINT RETURNS NONE OF THIS. `GET /vcaas/projects` gives only
 * `{ projectId, description, plan, createdAt }`. Status therefore requires a
 * per-project `GET /vcaas/projects/{id}`, which is why the dashboard fetches detail
 * lazily per visible card and renders `pending` until it arrives — see
 * `useProjectDetails`.
 */
export type ProjectStatus =
    | "building"
    | "running"
    | "deployed"
    | "stopped"
    | "failed"
    | "pending";

export interface ProjectStatusInfo {
    status: ProjectStatus;
    tone: StatusTone;
    /** Key into `status.*`. Callers translate it — this module owns no copy. */
    labelKey: TranslationKey;
    /** True only for genuinely in-flight states, so the pill's dot animates. */
    pulse: boolean;
}

const INFO: Record<ProjectStatus, Omit<ProjectStatusInfo, "status">> = {
    building: { tone: "info", labelKey: "status.building", pulse: true },
    running: { tone: "success", labelKey: "status.running", pulse: false },
    deployed: { tone: "brand", labelKey: "status.deployed", pulse: false },
    stopped: { tone: "neutral", labelKey: "status.stopped", pulse: false },
    failed: { tone: "danger", labelKey: "status.failed", pulse: false },
    pending: { tone: "outline", labelKey: "status.pending", pulse: false },
};

/**
 * ═══ THE CARD BADGE — TWO STATES, OR NOTHING ════════════════════════════════
 *
 * ⚠️ THIS IS NOT `getProjectStatus`, AND THE DIFFERENCE IS DELIBERATE. The six
 * statuses above answer "what is this project's condition" and still drive the
 * card's PICTURE — the shimmer under the chrome bar while it builds, the dimmed
 * screen when it is archived. The BADGE answers a much narrower question, and it
 * is the one the grid is for: **is something happening to it right now, and is it
 * live?**
 *
 * Everything else was noise. A grid of twelve projects showed twelve pills —
 * Running, Stopped, Pending, Failed — on cards where the pill was the only thing
 * with colour, and none of those four told the owner anything they could act on:
 * "Running" is the resting state of every project that has ever been opened, and
 * "Pending" only ever meant "the detail request has not landed yet".
 *
 * So there are exactly two badges, and no badge is the common case:
 *
 *   `promptRunning` — the agent is mid-run. The one genuinely live thing.
 *   `deployed`      — a deployment has succeeded, so the world can see it.
 *   `null`          — everything else. An idle, unpublished, perfectly healthy
 *                     project wears nothing at all.
 *
 * ⚠️ A RUNNING PROMPT OUTRANKS A SUCCESSFUL DEPLOY, because it is the thing that
 * is changing. A published project being edited reads "prompt running" while the
 * run is in flight and goes back to "deployed" when it finishes.
 *
 * ⚠️ "DEPLOYED, BUT ONLY IF NOTHING HAS BEEN PROMPTED SINCE" IS NOT IMPLEMENTABLE
 * AND IS NOT IMPLEMENTED. It would be the better rule — the badge would then mean
 * "what is live is what you last asked for" — but VCaaS gives us
 * `deployment.createdAt` and NO timestamp for the last finished run, so there is
 * nothing to compare it against. Guessing from `agentProcessStatus: "done"` would
 * be wrong in both directions: it is also "done" for a project whose last run was
 * a month before the deploy. If a `lastRunAt` (or similar) ever appears on the
 * project detail, this is the function to change and the comparison is one line.
 */
export type ProjectBadge = "promptRunning" | "deployed";

export interface ProjectBadgeInfo {
    badge: ProjectBadge;
    tone: StatusTone;
    labelKey: TranslationKey;
    /** Only the in-flight badge animates. */
    pulse: boolean;
}

const BADGE_INFO: Record<ProjectBadge, Omit<ProjectBadgeInfo, "badge">> = {
    promptRunning: { tone: "info", labelKey: "status.promptRunning", pulse: true },
    deployed: { tone: "brand", labelKey: "status.deployed", pulse: false },
};

export function getProjectBadge(detail: VcaasProject | null | undefined): ProjectBadgeInfo | null {
    if (!detail) return null;

    /*
      ⚠️ `agentProcessStatus`, NOT the server status. "Creating"/"Starting" is a
      sandbox waking up, which happens when someone merely OPENS a project — it is
      not a prompt, and badging it as one would put "prompt running" on a project
      nobody has typed into.
    */
    if (detail.agentProcessStatus === "init") {
        return { badge: "promptRunning", ...BADGE_INFO.promptRunning };
    }

    if (isPublished(detail)) return { badge: "deployed", ...BADGE_INFO.deployed };

    return null;
}

/**
 * A project only serves traffic at its production URL once a deployment has
 * SUCCEEDED. `productionProjectUrl` is populated regardless, so linking to it
 * without this check sends people to a dead host — the reference implementation
 * guards the same way (`detailIsPublished`).
 */
export function isPublished(detail: VcaasProject | null | undefined): boolean {
    return detail?.deployment?.status === "success";
}

export function getProjectStatus(detail: VcaasProject | null | undefined): ProjectStatusInfo {
    const status = resolve(detail);
    return { status, ...INFO[status] };
}

function resolve(detail: VcaasProject | null | undefined): ProjectStatus {
    if (!detail) return "pending";

    const server = detail.agentServerStatus;

    // 1. Anything actively in motion.
    if (
        detail.agentProcessStatus === "init" ||
        detail.deployment?.status === "deploying" ||
        server === "Creating" ||
        server === "Starting" ||
        server === "Unarchiving"
    ) {
        return "building";
    }

    // 2. Published and live.
    if (isPublished(detail)) return "deployed";

    // 4. Down. Checked before `running` because an archived project is never Active.
    if (server === "Archived" || server === "Archiving") return "stopped";

    // 3. Up, previewable, unpublished.
    if (server === "Active") return "running";

    // 5. The last deployment failed and nothing above replaced that picture.
    if (detail.deployment?.status === "error") return "failed";

    return "pending";
}

/**
 * ═══ THE PREVIEW URL — THE ONE IMPLEMENTATION ═══════════════════════════════
 *
 * ⚠️ `developmentUrlFieldToUse` IS A FIELD NAME, NOT A URL. This is the single
 * easiest thing to get wrong in the whole VCaaS surface, and Phase 07 got it
 * wrong here: the original version of this function had
 * `… || detail.developmentUrlFieldToUse || null` as its last fallback, which
 * would have returned the literal string `"cachedDevelopmentUrl"` and rendered it
 * as an iframe `src`. It also ignored the selection rule entirely by always
 * preferring the live URL. Fixed in Phase 08; the dashboard thumbnail and the
 * workspace preview now share this one implementation.
 *
 * The rule, quoted from `project-docs/totalum-api-docs.md`:
 *
 *   "Use `data.developmentUrlFieldToUse` to decide which development URL to
 *    display. It returns the NAME of the response field containing the best URL
 *    for the current state. … If `developmentUrlFieldToUse` is null or undefined,
 *    always fall back to `data.temporalDevelopmentProjectUrl`."
 *
 * `cachedDevelopmentUrl` is a STATIC SNAPSHOT served while the sandbox is
 * archived; the live URL comes back once the server is up and a prompt finishes.
 * Callers must tell the user which one they are looking at — see `isCachedPreview`.
 *
 * ⚠️ NEVER CACHE THE RESULT. The docs require re-reading the project (and this
 * field) on: navigating to the project, a manual refresh, and **every time an
 * agent run reaches `done`**. The workspace does exactly that.
 */
export type PreviewUrlField = "temporalDevelopmentProjectUrl" | "cachedDevelopmentUrl";

const DEFAULT_PREVIEW_FIELD: PreviewUrlField = "temporalDevelopmentProjectUrl";

/** Which field VCaaS says to read right now, normalised and defaulted. */
export function getPreviewUrlField(detail: VcaasProject | null | undefined): PreviewUrlField {
    return detail?.developmentUrlFieldToUse === "cachedDevelopmentUrl"
        ? "cachedDevelopmentUrl"
        : DEFAULT_PREVIEW_FIELD;
}

export function getPreviewUrl(detail: VcaasProject | null | undefined): string | null {
    if (!detail) return null;

    const field = getPreviewUrlField(detail);
    const chosen = detail[field];
    if (chosen) return chosen;

    // The chosen field can be empty on a project that has never been archived (or
    // has never started). Fall back to the other one rather than showing nothing —
    // a snapshot is more useful than an empty panel.
    return detail.temporalDevelopmentProjectUrl || detail.cachedDevelopmentUrl || null;
}

/**
 * True when what the user is looking at is the STATIC SNAPSHOT, not the live dev
 * server. The workspace and the dashboard both surface this: a snapshot silently
 * presented as live is how someone concludes their last prompt did nothing.
 */
export function isCachedPreview(detail: VcaasProject | null | undefined): boolean {
    if (!detail) return false;

    /**
     * ⚠️⚠️ THIS ASKS WHAT WE ARE ACTUALLY RENDERING, NOT WHAT WAS RECOMMENDED — and
     * it used to only get that right in ONE of the two directions.
     *
     * The old test was `getPreviewUrlField(detail) === "cachedDevelopmentUrl"`, which
     * reads the RECOMMENDATION. `getPreviewUrl` does not always honour it: when the
     * recommended field is empty it falls back to the other one. So an archived
     * project whose `temporalDevelopmentProjectUrl` is gone — recommendation still
     * `temporalDevelopmentProjectUrl`, nothing there to serve — renders the SNAPSHOT
     * while this said "not cached".
     *
     * ⭐ THAT WAS A LIVE FALSE POSITIVE. `looksAsleep` uses this as its entire
     * safety check ("are we looking at the snapshot rather than the dead live URL"),
     * so those projects got a "your server is asleep" overlay thrown over a
     * perfectly healthy static copy of their app — and, separately, never got the
     * "cached snapshot" banner that explains what they are looking at.
     *
     * Comparing the RESOLVED url is what the comment always claimed this did, and it
     * is right in both directions by construction.
     */
    const rendered = getPreviewUrl(detail);
    return !!rendered && !!detail.cachedDevelopmentUrl && rendered === detail.cachedDevelopmentUrl;
}

/**
 * ═══ ⚠️⚠️ `productionProjectUrl` IS A HOSTNAME, NOT A URL ════════════════════
 *
 * From the API reference, verbatim:
 *
 *   `"productionProjectUrl": "app.mysite.com"`  // custom domain if active,
 *                                               // otherwise "my-app.totalum-project.com"
 *
 * **No scheme.** It was returned from here untouched, so every consumer rendered
 * `<a href="simple-landing-page.totalum-project.com">` — which a browser resolves
 * RELATIVE TO THE CURRENT PAGE. Clicking "open live app" navigated to
 * `http://localhost:3000/simple-landing-page.totalum-project.com`, a route that
 * does not exist, and the user got a blank 404 on our own domain instead of their
 * published site. **Reported from the dashboard.**
 *
 * ⚠️ IT IS NOT ENOUGH TO PREFIX `https://`. A protocol-relative value (`//host`)
 * would silently inherit `http:` on a local dev server, and a value that ALREADY
 * carries a scheme must not become `https://https://…`. So the shape is normalised
 * rather than concatenated, and `http://` is upgraded — every project host we
 * serve is TLS, and an `http` link is a redirect at best and a warning at worst.
 */
export function toAbsoluteProjectUrl(value: string | null | undefined): string | null {
    const raw = (value || "").trim();
    if (!raw) return null;

    // `//host/path` — protocol-relative. Pin it to https rather than to whatever
    // scheme the page happens to be served over.
    if (raw.startsWith("//")) return `https:${raw}`;

    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
        const url = new URL(withScheme);
        // Anything that is not a real host (a stray path, an empty value) is not a
        // link, and half a link is worse than none — the caller hides the control.
        if (!url.hostname.includes(".")) return null;
        if (url.protocol === "http:") url.protocol = "https:";
        return url.toString().replace(/\/$/, "");
    } catch {
        return null;
    }
}

/**
 * The public URL — `null` unless the project is genuinely published.
 *
 * ⚠️ ALWAYS ABSOLUTE. See `toAbsoluteProjectUrl`: the upstream field is a bare
 * hostname, and every caller of this function puts the result straight into an
 * `href`.
 */
export function getProductionUrl(detail: VcaasProject | null | undefined): string | null {
    if (!isPublished(detail)) return null;
    return toAbsoluteProjectUrl(detail?.customDomain?.hostname || detail?.productionProjectUrl);
}

/**
 * The HOST this project serves on when published — scheme-less, for DISPLAY.
 *
 * ⚠️ IT IS NOT `getProductionUrl`, AND BOTH ARE NEEDED. That one answers "is there a
 * live site to link to" and returns `null` until a deploy has succeeded, which is
 * correct for a link and useless for the two screens that have to name the address
 * BEFORE it exists: the publish dialog ("it will be live at…") and the
 * just-published dialog, which is opened at the instant the deploy settles and
 * cannot wait for the project document to catch up.
 *
 * ⚠️ THE FALLBACK IS THE DOCUMENTED CONVENTION, not a guess: `productionProjectUrl`
 * is absent before the first deploy, and a project always publishes at
 * `{projectId}.totalum-project.com` unless a custom domain is ACTIVE. `pending`
 * domains are deliberately ignored — DNS that has not verified serves nothing, so
 * showing it would name an address that does not answer.
 */
export function getPublishedHost(
    detail: VcaasProject | null | undefined,
    projectId: string
): string {
    const domain = detail?.customDomain;
    const host =
        domain?.status === "active" && domain.hostname
            ? domain.hostname
            : detail?.productionProjectUrl || `${projectId}.totalum-project.com`;

    return host.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}
