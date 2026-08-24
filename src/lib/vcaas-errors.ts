/**
 * VCaaS ERROR NORMALISATION.
 *
 * VCaaS answers `{ errors: { errorCode, errorMessage } | null, data }` with ~60
 * distinct `errorCode` strings (see `www.totalum.app/docs/api` — the published docs
 * are the only reference; this repo deliberately keeps no copy of them),
 * plus `403 VCAAS_INSUFFICIENT_CREDITS` from the credit gate in front of the whole
 * API (CONTEXT §4.7).
 *
 * The UI must not switch on sixty strings. This maps them onto a small, stable
 * union that later phases can exhaustively handle:
 *
 *   INSUFFICIENT_CREDITS — out of credits ⇒ Phase 16's modal (upgrade / buy)
 *   PLAN_REQUIRED        — a paid-plan feature ⇒ Phase 10's <PaidFeature> upsell
 *   PROJECT_LIMIT_REACHED — the account owns as many projects as its plan allows
 *   PROJECT_NOT_FOUND    — no such project FOR THIS USER (see the note below)
 *   RATE_LIMITED         — back off and retry
 *   VALIDATION           — the request was malformed; show the message
 *   UNKNOWN              — anything else; show a generic error with retry
 *
 * ⚠️ TWO OF THESE ARE NEVER PRODUCED BY `normalizeVcaasError` — `PLAN_REQUIRED`
 * (from `requirePaidPlan`) and `UPLOAD_QUOTA_EXCEEDED` (from the upload route's own
 * daily cap). They are PLATFORM refusals that never reach VCaaS at all, and they
 * live in this union for the reason the union exists: it is the one list of codes
 * the client switches on, and a platform gate that invented its own vocabulary
 * would be a code the UI silently falls through to "something went wrong".
 *
 * ⚠️ `UPLOAD_QUOTA_EXCEEDED` IS NOT `RATE_LIMITED`, deliberately. `RATE_LIMITED`
 * means "back off and retry" and the client's retry loop treats it that way; this
 * one is a 24-hour ceiling, where retrying in 1.5 seconds is pure noise. Same HTTP
 * status, opposite instruction.
 *
 * ⚠️ THIS MODULE IS SHARED BY BOTH RUNTIMES. It is pure (no fetch, no env, no
 * secret) so the client layer can switch on the same union the server produced.
 * Never import anything server-only here.
 */

export type VcaasErrorCode =
    | "INSUFFICIENT_CREDITS"
    | "PLAN_REQUIRED"
    | "PROJECT_LIMIT_REACHED"
    | "PROJECT_NOT_FOUND"
    | "RATE_LIMITED"
    | "VALIDATION"
    | "UPLOAD_QUOTA_EXCEEDED"
    | "UNKNOWN";

/**
 * Upstream's per-code detail. One loose bag rather than a union, because it is
 * populated by exactly two codes today and each reads only its own keys.
 *
 * ⚠️ EVERY FIELD IS OPTIONAL AND UNTRUSTED. It crosses a service boundary from a
 * deployment that may be older than this file, so a consumer must render correctly
 * when the whole object is absent.
 */
export interface VcaasErrorDetails {
    /** `SANDBOX_NOT_REACHABLE`: "starting" | "app_error". */
    reason?: string;
    httpStatus?: number;
    /** `MAX_PROJECTS_REACHED`: the ceiling, a number or the "unlimited" sentinel. */
    maxProjects?: number | "unlimited";
    /** `MAX_PROJECTS_REACHED`: how many the account owns right now. */
    projectsUsed?: number;
    /** `MAX_PROJECTS_REACHED`: the plan they are on, and the cheapest that fits. */
    plan?: string | null;
    upgradePlan?: string | null;
}

export interface NormalizedVcaasError {
    /** The stable union the UI switches on. */
    code: VcaasErrorCode;
    /** VCaaS's own message. Safe to show — it never contains a credential. */
    message: string;
    /** The raw upstream code, kept for logs and for phases that need precision. */
    upstreamCode?: string;
    /**
     * ⭐ UPSTREAM'S OWN DETAIL, WHEN ONE CODE COVERS TWO SITUATIONS.
     *
     * ⚠️ `SANDBOX_NOT_REACHABLE` is the only user of this so far, and it is the reason it
     * exists: a publish is refused both while the server is still coming up (wait) and
     * when the app is running but broken (a prompt is needed, waiting changes nothing).
     * The stable `code` union deliberately does not grow for that — see the note on
     * `VcaasErrorCode` — so the distinction travels here instead.
     */
    details?: VcaasErrorDetails;
    /** The HTTP status the proxy route should return. */
    status: number;
}

/** Out of credits. The credit gate's own code is `VCAAS_INSUFFICIENT_CREDITS`. */
const INSUFFICIENT: ReadonlySet<string> = new Set([
    "INSUFFICIENT_CREDITS",
    "VCAAS_INSUFFICIENT_CREDITS",
    "PROJECT_CREDIT_LIMIT_REACHED",
    "PROJECT_EXPORT_LIMIT_REACHED",
    "PROJECT_IMPORT_LIMIT_REACHED",
]);

/**
 * A paid plan (or API access) is required.
 *
 * `PLAN_NOT_API` / `PROJECT_NOT_ALLOWED` come from VCaaS's `isApiAccessAllowed()`
 * check (CONTEXT §4.10). The `PLATFORM_FREE_PLAN_*` codes are the free-plan gates
 * Phase 20 adds in totalum-backend for source download, GitHub and custom domains.
 */
const PLAN: ReadonlySet<string> = new Set([
    "PLAN_REQUIRED",
    "PLAN_NOT_API",
    "PROJECT_NOT_ALLOWED",
    "PLATFORM_FREE_PLAN_NO_SOURCE_DOWNLOAD",
    "PLATFORM_FREE_PLAN_NO_GITHUB",
    "PLATFORM_FREE_PLAN_NO_CUSTOM_DOMAIN",
    "FREE_PLAN_NO_SOURCE_EDITING",
    "PAID_PLAN_REQUIRED",
]);

/**
 * No such project **for this caller**.
 *
 * ⚠️ THIS IS ALSO THE OWNERSHIP ANSWER. Because the request carries the caller's
 * own account-scoped system key, VCaaS returns `PROJECT_NOT_FOUND` both for a
 * project that does not exist AND for one that belongs to somebody else — the two
 * are deliberately indistinguishable, so this surface is not a project-enumeration
 * oracle. Do not "improve" that by adding a distinct FORBIDDEN code.
 */
const NOT_FOUND: ReadonlySet<string> = new Set([
    "PROJECT_NOT_FOUND",
    "MISSING_PROJECT_ID",
    "TABLE_NOT_FOUND",
    "WEBHOOK_NOT_FOUND",
    "NO_DEPLOYMENT",
]);

const RATE_LIMITED: ReadonlySet<string> = new Set([
    "RATE_LIMIT_EXCEEDED",
    "TOO_MANY_PROMPTS",
]);

/**
 * The account already owns every project its plan allows.
 *
 * ⚠️ IT IS **NOT** `RATE_LIMITED`, AND THAT DISTINCTION IS THE WHOLE POINT. Both
 * refuse a create, but a rate limit means "wait ten seconds" and this one means
 * "waiting will never help" — the account has to delete a project or upgrade.
 * Folding it into `RATE_LIMITED` would put a client's retry loop in front of a
 * wall it can never pass, and would show the user a "try again shortly" message
 * that is simply false.
 *
 * ⚠️ NOR IS IT `PLAN_REQUIRED`, which means "this FEATURE needs a paid plan" and
 * drives the `<PaidFeature>` upsell. Every paid plan can create projects; this one
 * is about running out of a quantity the customer already bought.
 */
const PROJECT_LIMIT: ReadonlySet<string> = new Set(["MAX_PROJECTS_REACHED"]);

/**
 * Everything the caller can fix by changing the request. Kept explicit rather than
 * "starts with MISSING_/INVALID_" so a new upstream code lands in UNKNOWN — visible
 * — instead of being silently swallowed as a validation error.
 */
const VALIDATION: ReadonlySet<string> = new Set([
    "MISSING_DATA", "MISSING_FILE", "MISSING_GITHUB_FIELDS", "MISSING_HOSTNAME",
    "MISSING_IMPORT_CODE", "MISSING_LIMIT_FIELDS", "MISSING_PROMPT", "MISSING_RECORD_ID",
    "MISSING_SECRET_FIELDS", "MISSING_SECRET_ID", "MISSING_TABLE_NAME", "MISSING_VERSION_ID",
    "MISSING_WEBHOOK_FIELDS",
    "INVALID_LIMIT", "INVALID_MULTI_PROMPT", "INVALID_PROJECT_NAME",
    "INVALID_PROJECT_NAME_LENGTH", "INVALID_PROMPT_ITEM", "INVALID_SECRET_KEY_NAME",
    "INVALID_SYNC_DIRECTION", "INVALID_WEBHOOK_EVENT", "INVALID_WEBHOOK_URL",
    "PROJECT_ALREADY_EXISTS", "WEBHOOK_EVENT_ALREADY_EXISTS",
    "PROMPT_SECURITY_VIOLATION",
    // `createProject` rejects any id containing `-dev-`; totalum-backend derives
    // development hostnames from that fragment. Added in Phase 07 — the dashboard
    // is the first surface that lets a user type a project name.
    "RESERVED_PROJECT_NAME",
]);

/** Default HTTP status per normalized code. */
const STATUS_FOR: Record<VcaasErrorCode, number> = {
    INSUFFICIENT_CREDITS: 402,
    PLAN_REQUIRED: 403,
    PROJECT_LIMIT_REACHED: 403,
    PROJECT_NOT_FOUND: 404,
    RATE_LIMITED: 429,
    VALIDATION: 400,
    /**
     * ⚠️ NEVER REACHED BY `normalizeVcaasError` — `classify` cannot return this,
     * because the daily upload cap is a PLATFORM refusal that never touches VCaaS.
     * It is here because `Record<VcaasErrorCode, …>` demands it, and that demand is
     * the useful part: adding a code to the union without deciding its status would
     * otherwise compile.
     */
    UPLOAD_QUOTA_EXCEEDED: 429,
    UNKNOWN: 502,
};

function classify(upstreamCode: string | undefined, httpStatus: number): VcaasErrorCode {
    const code = (upstreamCode || "").toUpperCase();

    if (INSUFFICIENT.has(code)) return "INSUFFICIENT_CREDITS";
    /* ⚠️ BEFORE `PLAN`, and both are 403s — see the note on `PROJECT_LIMIT`. */
    if (PROJECT_LIMIT.has(code)) return "PROJECT_LIMIT_REACHED";
    if (PLAN.has(code)) return "PLAN_REQUIRED";
    if (NOT_FOUND.has(code)) return "PROJECT_NOT_FOUND";
    if (RATE_LIMITED.has(code)) return "RATE_LIMITED";
    if (VALIDATION.has(code)) return "VALIDATION";

    // Fall back to the HTTP status when the code is unrecognised or absent — this is
    // what catches `403 VCAAS_INSUFFICIENT_CREDITS` shapes the gate may change, and
    // any future code we have not seen.
    if (httpStatus === 402) return "INSUFFICIENT_CREDITS";
    if (httpStatus === 429) return "RATE_LIMITED";
    if (httpStatus === 404) return "PROJECT_NOT_FOUND";
    if (httpStatus === 400 || httpStatus === 422) return "VALIDATION";

    return "UNKNOWN";
}

/**
 * Normalise a VCaaS error envelope.
 *
 * `httpStatus` is the upstream HTTP status; `errors` is VCaaS's `errors` object (or
 * anything shaped like it). Both may be absent — a bare 500 still produces a sane
 * `UNKNOWN`.
 */
export function normalizeVcaasError(
    errors:
        | { errorCode?: string; errorMessage?: string; errorDetails?: VcaasErrorDetails }
        | null
        | undefined,
    httpStatus: number,
    fallbackMessage = "The request could not be completed"
): NormalizedVcaasError {
    const upstreamCode = errors?.errorCode;
    const code = classify(upstreamCode, httpStatus);

    return {
        code,
        message: errors?.errorMessage || fallbackMessage,
        upstreamCode,
        details: errors?.errorDetails,
        // Prefer a truthful upstream 4xx; otherwise use the code's canonical status.
        // A 5xx upstream becomes 502 (we are the gateway), never a misleading 500.
        status: httpStatus >= 400 && httpStatus < 500 ? httpStatus : STATUS_FOR[code],
    };
}

/** The envelope every `/api/vcaas/*` route returns on failure. */
export interface VcaasErrorEnvelope {
    ok: false;
    error: string;
    /** The stable union. UI code switches on THIS. */
    code: VcaasErrorCode;
    /** The raw upstream code, for debugging. Never a secret. */
    upstreamCode?: string;
    /** Upstream's detail for codes that cover more than one situation. */
    details?: VcaasErrorDetails;
    data: null;
}

export function toErrorEnvelope(normalized: NormalizedVcaasError): VcaasErrorEnvelope {
    return {
        ok: false,
        error: normalized.message,
        code: normalized.code,
        upstreamCode: normalized.upstreamCode,
        details: normalized.details,
        data: null,
    };
}

/**
 * Narrow an `{ ok:false, code }` response from the client layer.
 *
 * ⚠️ `UPLOAD_QUOTA_EXCEEDED` IS ABSENT ON PURPOSE and always was: it is a PLATFORM
 * refusal that never travels in a VCaaS envelope, so accepting it here would let a
 * value that cannot arrive narrow as if it had.
 */
export function isVcaasErrorCode(value: unknown): value is VcaasErrorCode {
    return (
        value === "INSUFFICIENT_CREDITS" ||
        value === "PLAN_REQUIRED" ||
        value === "PROJECT_LIMIT_REACHED" ||
        value === "PROJECT_NOT_FOUND" ||
        value === "RATE_LIMITED" ||
        value === "VALIDATION" ||
        value === "UNKNOWN"
    );
}
