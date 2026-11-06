/**
 * The two limits of the TOTALUM ACCOUNT behind this builder's API key, and the one
 * place that turns a VCaaS refusal into the modal that explains them.
 *
 *   credits  — `INSUFFICIENT_CREDITS` (402) or the credit gate's `VCAAS_INSUFFICIENT_CREDITS` (403)
 *   projects — `MAX_PROJECTS_REACHED` (403) on create, import or duplicate
 *
 * Both are fixed on Totalum, not here, so both modals send the operator to the same page.
 * Pure (no React, no fetch) so the client layer and the tests share it.
 */
import type { VcaasErrorDetails } from "@/lib/vcaas-errors";

export const TOTALUM_UPGRADE_URL = "https://www.totalum.app/whitelabel";

/** Raised on `window` by the VCaaS client; `<TotalumLimitModal>` answers it. */
export const TOTALUM_LIMIT_EVENT = "totalum:account-limit";

export type TotalumLimit =
    | { kind: "credits" }
    | { kind: "projects"; details?: VcaasErrorDetails };

/** Upstream codes that mean the Totalum account itself is out of credits. */
const ACCOUNT_CREDITS = new Set(["INSUFFICIENT_CREDITS", "VCAAS_INSUFFICIENT_CREDITS"]);

/**
 * Which Totalum limit a failed `/api/vcaas/*` envelope hit, or null.
 * A per-project credit cap (`PROJECT_CREDIT_LIMIT_REACHED`) is not the account running out,
 * so it keeps its own copy. A bare 402 with no upstream code still counts.
 */
export function totalumLimitOf(payload: {
    ok?: boolean;
    code?: string;
    upstreamCode?: string;
    details?: VcaasErrorDetails;
} | null | undefined): TotalumLimit | null {
    if (!payload || payload.ok !== false) return null;
    if (payload.code === "PROJECT_LIMIT_REACHED" || payload.upstreamCode === "MAX_PROJECTS_REACHED") {
        return { kind: "projects", details: payload.details };
    }
    const upstream = payload.upstreamCode?.toUpperCase();
    if (payload.code === "INSUFFICIENT_CREDITS" && (!upstream || ACCOUNT_CREDITS.has(upstream))) {
        return { kind: "credits" };
    }
    return null;
}

/** "2 of 2 projects", or null when upstream sent no usable numbers. */
export function projectUsage(details?: VcaasErrorDetails): string | null {
    const used = details?.projectsUsed;
    const max = details?.maxProjects;
    if (typeof used !== "number" || typeof max !== "number") return null;
    return `${used} of ${max} project${max === 1 ? "" : "s"}`;
}

export function totalumLimitCopy(limit: TotalumLimit): { title: string; description: string; usage: string | null } {
    if (limit.kind === "projects") {
        return {
            title: "Project limit reached",
            description:
                "The Totalum account behind this app builder has reached its plan's project limit. Upgrade the Totalum plan to have more projects.",
            usage: projectUsage(limit.details),
        };
    }
    return {
        title: "Out of Totalum credits",
        description:
            "The Totalum account behind this app builder is out of credits. Buy Totalum credits or upgrade the Totalum plan, then try again. Nothing you've built is lost.",
        usage: null,
    };
}

/** Tell the modal, if this response hit a Totalum limit. Never changes the response. */
export function signalTotalumLimit(payload: Parameters<typeof totalumLimitOf>[0]): void {
    if (typeof window === "undefined") return;
    const limit = totalumLimitOf(payload);
    if (limit) window.dispatchEvent(new CustomEvent<TotalumLimit>(TOTALUM_LIMIT_EVENT, { detail: limit }));
}
