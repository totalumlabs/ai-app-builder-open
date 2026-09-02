"use client";

import * as React from "react";

/**
 * ═══ SHIM — THE PLATFORM'S PLAN GATE, WITH NO PLAN TO GATE ON ═════════════════
 *
 * totalum-platform wraps GitHub and custom domains in `<PaidFeature>` and shows a
 * `<CapabilityUsage>` counter ("1 of 4 projects using custom domains") because there
 * the user is on a plan with quotas. This app runs on ONE API key that belongs to the
 * operator, so there is no plan to check and nothing to meter: the gate renders its
 * children and the counter renders nothing.
 *
 * The signatures match the platform's so `DomainModal.tsx` and `GithubModal.tsx` can
 * be copied over unchanged — that is the whole reason this file exists.
 */
export function PaidFeature({ children }: {
    feature: string;
    projectId?: string;
    variant?: string;
    className?: string;
    children?: React.ReactNode;
}) {
    return <>{children}</>;
}

export function CapabilityUsage(_props: { capability: string; projectId?: string; className?: string }) {
    return null;
}
