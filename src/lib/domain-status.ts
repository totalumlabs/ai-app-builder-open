import type { StatusTone } from "@/components/primitives";
import type { TranslationKey } from "@/i18n";
import type { VcaasDomain } from "@/lib/vcaas-types";

/**
 * ═══ HOW FAR ALONG IS THIS CUSTOM DOMAIN? ═══════════════════════════════════
 *
 * Attaching a domain is the only thing in the product whose completion is out of
 * our hands AND out of the user's: they add two or three records at a registrar we
 * cannot see, and then the internet takes somewhere between four minutes and five
 * hours to agree about it. Until it does, the product's only honest answer is
 * "waiting" — and a bare "Pending DNS" pill, which is all we used to show, is
 * indistinguishable from "broken" after the first ten minutes.
 *
 * So this module turns the two independent status fields VCaaS gives us into ONE
 * ordered narrative with a position in it:
 *
 *   `status`     pending_validation → pending_deployment → active | blocked
 *                (also `pending_deletion` while a removal is in flight)
 *                — has Cloudflare seen the ownership records for this hostname?
 *
 *   `sslStatus`  initializing → authorizing → issuing → active
 *                (or expired | timing_out | validation_timed_out when it gives up)
 *                — has a certificate been issued for it?
 *
 * ⚠️ THEY MOVE INDEPENDENTLY, which is exactly why one pill could never tell the
 * story: a hostname can sit in `pending_validation` with `sslStatus: "issuing"`,
 * which means the DNS half is genuinely further along than the headline status
 * suggests. Reading only `status` there shows a user who has done everything right
 * a bar that has not moved in twenty minutes.
 *
 * ── THE THREE STEPS ─────────────────────────────────────────────────────────
 *
 *   1. `dns`   — your records are visible to us
 *   2. `ssl`   — an HTTPS certificate is issued for the hostname
 *   3. `live`  — requests to the hostname reach your app
 *
 * Everything user-facing (the stepper in the domain modal, the compact bar in the
 * publish dialog, the "DNS pending" badge beside Publish) is derived from
 * `getDomainProgress` so the three can never disagree with each other.
 *
 * ⚠️ THIS MODULE OWNS NO COPY. It returns translation KEYS, like `project-status.ts`
 * — the caller translates. That is what lets the same derivation drive a 400px
 * stepper and a 24px badge.
 */

export type DomainStepId = "dns" | "ssl" | "live";

/** `waiting` = not started yet; `active` = in flight right now. */
export type DomainStepState = "waiting" | "active" | "done" | "failed";

export interface DomainStep {
    id: DomainStepId;
    state: DomainStepState;
    /**
     * The step's name, kept to one or two words. ⚠️ THE STEPPER IS AN INLINE RAIL
     * that sits between a progress bar and a countdown on a single row — a full
     * sentence per step is what made the first version taller than the DNS records
     * it was explaining.
     */
    titleKey: TranslationKey;
    /** What this step is doing *in its current state* — not a static description. */
    detailKey: TranslationKey;
}

export interface DomainProgress {
    /** Ordered, always three, always the same three. */
    steps: DomainStep[];
    /** 0-100. Half-credit for the step in flight, so the bar moves mid-step. */
    percent: number;
    tone: StatusTone;
    /** The short pill label (`workspace.deploy.domain*`). */
    labelKey: TranslationKey;
    /** What to DO about this state (`workspace.domain.help*`). */
    helpKey: TranslationKey;
    /** Live and serving. */
    isLive: boolean;
    /** Something went wrong and waiting longer will not fix it. */
    isFailed: boolean;
    /**
     * Still moving — the one flag that drives POLLING and the pulsing dot.
     * False for `active`, `blocked` and the SSL give-up states, so a settled
     * domain costs nothing to keep on screen.
     */
    isSettling: boolean;
}

/** SSL states that mean Cloudflare has stopped trying. */
const SSL_FAILED = new Set(["expired", "timing_out", "validation_timed_out"]);

/** SSL states that prove the ownership records have already been seen. */
const SSL_IN_FLIGHT = new Set(["authorizing", "issuing"]);

const STEP_COPY: Record<DomainStepId, Record<DomainStepState, TranslationKey>> = {
    dns: {
        waiting: "workspace.domain.stepDnsWaiting",
        active: "workspace.domain.stepDnsActive",
        done: "workspace.domain.stepDnsDone",
        failed: "workspace.domain.stepDnsFailed",
    },
    ssl: {
        waiting: "workspace.domain.stepSslWaiting",
        active: "workspace.domain.stepSslActive",
        done: "workspace.domain.stepSslDone",
        failed: "workspace.domain.stepSslFailed",
    },
    live: {
        waiting: "workspace.domain.stepLiveWaiting",
        active: "workspace.domain.stepLiveActive",
        done: "workspace.domain.stepLiveDone",
        failed: "workspace.domain.stepLiveFailed",
    },
};

const STEP_TITLE: Record<DomainStepId, TranslationKey> = {
    dns: "workspace.domain.stepDnsShort",
    ssl: "workspace.domain.stepSslShort",
    live: "workspace.domain.stepLiveShort",
};

function step(id: DomainStepId, state: DomainStepState): DomainStep {
    return { id, state, titleKey: STEP_TITLE[id], detailKey: STEP_COPY[id][state] };
}

/** Half-credit for the step in flight — a bar frozen on a boundary reads as stuck. */
function percentFor(steps: DomainStep[]): number {
    const earned = steps.reduce((total, s) => {
        if (s.state === "done") return total + 1;
        if (s.state === "active") return total + 0.5;
        return total;
    }, 0);
    // Never 0: a domain that exists at all has had its records generated, and an
    // empty bar reads as "nothing happened", which is not what is true.
    return Math.max(8, Math.round((earned / steps.length) * 100));
}

export function getDomainProgress(domain: VcaasDomain | null | undefined): DomainProgress | null {
    if (!domain?.hostname) return null;

    const status = domain.status;
    const ssl = domain.sslStatus;

    // ── Terminal: live ──────────────────────────────────────────────────────
    if (status === "active") {
        return {
            steps: [step("dns", "done"), step("ssl", "done"), step("live", "done")],
            percent: 100,
            tone: "success",
            labelKey: "workspace.deploy.domainActive",
            helpKey: "workspace.domain.helpActive",
            isLive: true,
            isFailed: false,
            isSettling: false,
        };
    }

    // ── Terminal: refused ───────────────────────────────────────────────────
    if (status === "blocked") {
        return {
            steps: [step("dns", "failed"), step("ssl", "waiting"), step("live", "waiting")],
            percent: 100,
            tone: "danger",
            labelKey: "workspace.deploy.domainBlocked",
            helpKey: "workspace.domain.helpBlocked",
            isLive: false,
            isFailed: true,
            isSettling: false,
        };
    }

    // ── Transient: being detached ───────────────────────────────────────────
    // Not settling: nothing here will progress, the row is about to vanish.
    if (status === "pending_deletion") {
        return {
            steps: [step("dns", "waiting"), step("ssl", "waiting"), step("live", "waiting")],
            percent: 100,
            tone: "neutral",
            labelKey: "workspace.deploy.domainRemoving",
            helpKey: "workspace.domain.helpRemoving",
            isLive: false,
            isFailed: false,
            isSettling: false,
        };
    }

    // ── In flight ───────────────────────────────────────────────────────────
    // ⚠️ THE DNS STEP IS DONE WHEN EITHER SIGNAL SAYS SO. `pending_deployment`
    // means validation passed; an SSL status past `initializing` means the
    // certificate authority resolved the hostname, which it cannot do without the
    // records. Trusting only `status` strands users who did everything right.
    const dnsSeen = status === "pending_deployment" || SSL_IN_FLIGHT.has(ssl) || ssl === "active";

    const sslFailed = SSL_FAILED.has(ssl);
    const sslDone = ssl === "active";

    const steps: DomainStep[] = [
        step("dns", dnsSeen ? "done" : "active"),
        step("ssl", sslFailed ? "failed" : sslDone ? "done" : dnsSeen ? "active" : "waiting"),
        step("live", sslDone && dnsSeen ? "active" : "waiting"),
    ];

    if (sslFailed) {
        return {
            steps,
            percent: percentFor(steps),
            tone: "danger",
            labelKey: "workspace.deploy.domainSslFailed",
            helpKey: "workspace.domain.helpSslFailed",
            isLive: false,
            isFailed: true,
            // The certificate attempt is over — polling will not revive it. The user
            // has to fix the records and re-add the domain.
            isSettling: false,
        };
    }

    return {
        steps,
        percent: percentFor(steps),
        tone: dnsSeen ? "info" : "warning",
        labelKey: dnsSeen ? "workspace.deploy.domainDeploying" : "workspace.deploy.domainPendingDns",
        helpKey: dnsSeen
            ? "workspace.domain.helpPendingDeployment"
            : "workspace.domain.helpPendingValidation",
        isLive: false,
        isFailed: false,
        isSettling: true,
    };
}

/**
 * Should anything keep polling for this domain? The single predicate behind the
 * modal's countdown AND the workspace's background refresh, so the two cannot
 * drift into polling forever over an `active` domain.
 */
export function isDomainSettling(domain: VcaasDomain | null | undefined): boolean {
    return getDomainProgress(domain)?.isSettling ?? false;
}

/**
 * Does the Publish button need a badge beside it? True whenever a domain is
 * attached and NOT yet live — including the failed states, which are the ones
 * most worth interrupting someone about.
 *
 * ⚠️ FALSE WHEN THERE IS NO DOMAIN, which is what makes the badge disappear the
 * moment it is removed: the badge has no state of its own to clear.
 */
export function isDomainAttentionNeeded(domain: VcaasDomain | null | undefined): boolean {
    const progress = getDomainProgress(domain);
    return progress ? !progress.isLive : false;
}

/**
 * Records usually verify inside half an hour. Past this, "be patient" stops being
 * useful advice and "check the records again" starts being the right one.
 */
export const DOMAIN_SLOW_AFTER_MS = 2 * 60 * 60 * 1000;

/** Milliseconds since the domain was attached, or null if the API didn't say. */
export function domainWaitingMs(
    domain: VcaasDomain | null | undefined,
    now: number = Date.now()
): number | null {
    if (!domain?.createdAt) return null;
    const started = new Date(domain.createdAt).getTime();
    if (!Number.isFinite(started)) return null;
    return Math.max(0, now - started);
}

/** Still waiting, and for long enough that the usual reassurance no longer applies. */
export function isDomainSlow(
    domain: VcaasDomain | null | undefined,
    now: number = Date.now()
): boolean {
    if (!isDomainSettling(domain)) return false;
    const waited = domainWaitingMs(domain, now);
    return waited !== null && waited > DOMAIN_SLOW_AFTER_MS;
}

/** `4 min` / `2 h 15 min` — the elapsed clock next to "waiting for DNS". */
export function formatWaiting(ms: number): string {
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 1) return "<1 min";
    if (minutes < 60) return `${minutes} min`;

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours < 24) return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;

    const days = Math.floor(hours / 24);
    const restHours = hours % 24;
    return restHours > 0 ? `${days} d ${restHours} h` : `${days} d`;
}
