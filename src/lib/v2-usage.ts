/**
 * Pure helpers of the v2 usage & per-feature limits panel (A6.34, plan 15 §4.10/§4.24).
 *
 * The panel computes nothing: every number is a field of the response, so the screen and
 * `GET /projects/:id/usage` always agree. The total is the response's own total — never a
 * client-side sum of the rows it happens to show.
 */

import type { FeatureLimit, V2Usage } from "@/lib/vcaas-types";

export interface UsageRow {
    dimension: string;
    units: number | null;
    unit: string | null;
    credits: number | null;
}

/** One row per dimension the server returned, in the server's order. */
export function usageRows(usage: V2Usage | null | undefined): UsageRow[] {
    const byDimension = usage?.totals?.byDimension;
    if (!byDimension || typeof byDimension !== "object") return [];
    return Object.entries(byDimension).map(([dimension, entry]) => ({
        dimension,
        units: typeof entry.units === "number" ? entry.units : null,
        unit: typeof entry.unit === "string" ? entry.unit : null,
        credits: typeof entry.credits === "number" ? entry.credits : null,
    }));
}

/** The response's total credits, or `null` when it did not send one. */
export function usageTotal(usage: V2Usage | null | undefined): number | null {
    const credits = usage?.totals?.credits;
    return typeof credits === "number" ? credits : null;
}

export type CapError = "notANumber" | "aboveCeiling";

/**
 * Validate a typed cap before `PUT …/limits`: empty = no cap of your own; a cap can only
 * lower what the plan allows (AB refuses `400 LIMIT_ABOVE_PLAN_CEILING`, never clamps).
 */
export function capError(raw: string, ceiling: number | null | undefined): CapError | null {
    if (raw.trim() === "") return null;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) return "notANumber";
    if (typeof ceiling === "number" && value > ceiling) return "aboveCeiling";
    return null;
}

/** abud: a project's monthly development budget (`creditLimits`): empty = no limit, else a whole number above 0. */
export function devBudgetError(raw: string): "notPositive" | null {
    if (raw.trim() === "") return null;
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? null : "notPositive";
}

/** `""` ⇒ `null` (back to the plan default), otherwise the number. */
export function capValue(raw: string): number | null {
    return raw.trim() === "" ? null : Number(raw);
}

/** A `ceo` row is read-only for every actor of the platform (plan 15 §8). */
export function isEditableFeature(limit: FeatureLimit | undefined): boolean {
    return limit?.source !== "ceo";
}
