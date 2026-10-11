import type { AgentEffort, AgentModelTier, AgentRunOptions } from "@/lib/vcaas-types";

export const EFFORTS: AgentEffort[] = ["low", "medium", "high", "xhigh"];
/**
 * v2 run tiers (A5.7, A5.31 — `cheap` is the budget mode; `auto`, automode 2026-10-05: the engine picks cheap or
 * normal per prompt, expensive only exceptionally). Default: `auto` (autodefault, A10.41, Francesc 2026-10-05).
 */
export const MODEL_TIERS: AgentModelTier[] = ["auto", "cheap", "normal", "expensive"];

/**
 * The tier the v2 picker shows: the saved choice, else `auto`. A prompt with no saved choice sends no tier and the
 * API's default (`auto`) applies, so what the picker shows is what runs.
 */
/** The tiers the v2 picker offers: only cheap on a `cheapOnly` account (no reason is ever shown). */
export const visibleTiers = (cheapOnly: boolean): AgentModelTier[] => (cheapOnly ? ["cheap"] : MODEL_TIERS);

export function selectedTier(options: AgentRunOptions, cheapOnly = false): AgentModelTier {
    if (cheapOnly) return "cheap";
    return options.modelTier ?? "auto";
}

/**
 * Fast mode on a v2 project (decide2: the expensive tier's opt-in). Off since f5fast (2026-10-02):
 * the new engine cannot serve it yet, so the toggle is hidden and a v2 prompt never sends
 * `fastMode` — the API would answer "fastMode is not available". Legacy fast mode is unchanged.
 */
export const V2_FAST_MODE_AVAILABLE: boolean = false;

/**
 * Keep only valid, non-default keys. A v2 tier replaces the legacy `model` (a v2 request sends
 * `modelTier` and omits `model`) and is the whole choice on v2: the tier decides the effort
 * (A10.10, 2026-09-30), so a tier never travels with `effort`. Fast mode is the expensive tier's
 * opt-in (decide2, 2026-10-02) while `V2_FAST_MODE_AVAILABLE`; otherwise a tier travels alone. Legacy keeps
 * model + effort + fast mode; fast mode is Opus-only, so never with `sonnet`.
 */
export function normalizeRunOptions(raw: AgentRunOptions): AgentRunOptions {
    const out: AgentRunOptions = {};
    if (raw.modelTier && MODEL_TIERS.includes(raw.modelTier))
        return V2_FAST_MODE_AVAILABLE && raw.modelTier === "expensive" && raw.fastMode === true
            ? { modelTier: raw.modelTier, fastMode: true }
            : { modelTier: raw.modelTier };
    if (raw.model === "sonnet") out.model = "sonnet";
    if (raw.effort && EFFORTS.includes(raw.effort)) out.effort = raw.effort;
    if (raw.fastMode === true && !out.model) out.fastMode = true;
    return out;
}

/** What a prompt sends: on v2 only the tier (+ fast mode on expensive), on legacy never a tier (A5.7). */
export function optionsForEngine(options: AgentRunOptions, v2: boolean): AgentRunOptions {
    if (!v2) return { ...options, modelTier: undefined };
    return options.modelTier ? normalizeRunOptions({ modelTier: options.modelTier, fastMode: options.fastMode }) : {};
}

/**
 * `GET /vcaas/account/v2-opt-in` `newProjectsEngine`: the engine the server gives this account's NEXT create (rollout
 * mode, the account's own "use the new builder" switch, bucket, allowlist), so /projects shows that engine's options.
 */
export function newProjectsDefaultToV2(status: { newProjectsEngine?: "v2" | "legacy" } | undefined): boolean {
    return status?.newProjectsEngine === "v2";
}

/** The switch is shown only when it would decide a create now, and only to someone who may change account settings. */
export function showV2OptIn(
    status: { v2OptIn: boolean; available: boolean } | undefined,
    canManageAccount: boolean | undefined
): boolean {
    return status?.available === true && canManageAccount === true;
}
