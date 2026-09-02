"use client";

import * as React from "react";
import { CheckCircle2Icon, ExternalLinkIcon, GlobeIcon, LoaderIcon, RocketIcon, TriangleAlertIcon } from "lucide-react";
import { ConfirmDialog, CopyButton, Modal, StatusPill } from "@/components/primitives";
import { PaidFeature, CapabilityUsage } from "@/components/plan/PaidFeature";
import { useCapabilities } from "@/components/plan/CapabilityProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n";
import { toast } from "@/lib/toast";
import { getDomainProgress, isDomainSettling } from "@/lib/domain-status";
import { vcaasApi } from "@/lib/vcaas";
import type { VcaasDomain, VcaasProject } from "@/lib/vcaas-types";
import { cn } from "@/lib/utils";
import { DomainProgressPanel } from "./DomainProgress";
import { useDirtyGuard } from "./use-dirty-guard";

/**
 * CUSTOM DOMAIN — a PAID feature.
 *
 * ⚠️ COSTS 2 CREDITS (`VCAAS_CREDIT_COSTS.ADD_CUSTOM_DOMAIN`) on top of the plan.
 *
 * ── THE "DEPLOY FIRST" GUARD ────────────────────────────────────────────────
 *
 * A custom domain points at the PRODUCTION deployment. Attaching one to a project
 * that has never been published produces a domain that resolves to nothing, and
 * the user has no way to tell whether they misconfigured DNS or simply had nothing
 * to serve. So the form is blocked until `deployment.status === 'success'`, with
 * the reason stated and a route to fix it.
 *
 * ── STATUS POLLING ──────────────────────────────────────────────────────────
 *
 * DNS verification is slow (minutes to hours). We poll while the status is
 * non-terminal and stop as soon as it settles — and the copy sets the expectation
 * up front, because a "pending" spinner with no timescale reads as broken.
 *
 * ⭐ WHAT THE WAIT LOOKS LIKE NOW. A pill alone could not distinguish minute two
 * from hour four, so the propagation state renders as a three-step stepper with a
 * bar, an elapsed clock, a visible countdown to the next check and a manual
 * "Check now" — all derived from `@/lib/domain-status`, which is also what draws
 * the compact bar in the publish dialog and the badge beside Publish. See that
 * module for why `status` alone is not enough to place a domain on that line.
 *
 * ⚠️ THE POLL USED TO RESTART ON EVERY PARENT RENDER. Its effect depended on
 * `onChanged`, which the workspace passes as an inline arrow — a new identity each
 * render, so the 20s interval was torn down and recreated long before it ever
 * fired, and a domain that verified while the modal sat open never updated. The
 * callback now lives in a ref and is deliberately NOT a dependency.
 */

const POLL_INTERVAL_MS = 20_000;

/** Accepts `example.com` and `app.example.com`; rejects schemes, paths and ports. */
const HOSTNAME_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export interface DomainModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    project: VcaasProject | null;
    onChanged: () => void;
}

export function DomainModal({ open, onOpenChange, projectId, project, onChanged }: DomainModalProps) {
    const t = useT();
    const { refresh: refreshCapabilities } = useCapabilities();

    const [hostname, setHostname] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const [removing, setRemoving] = React.useState(false);
    const [domain, setDomain] = React.useState<VcaasDomain | null>(project?.customDomain ?? null);

    const [checking, setChecking] = React.useState(false);
    /** Wall-clock instant of the next automatic check — the countdown's anchor. */
    const [nextCheckAt, setNextCheckAt] = React.useState<number | null>(null);
    const [now, setNow] = React.useState(() => Date.now());

    const isDirty = hostname.trim().length > 0;
    const guard = useDirtyGuard(isDirty, () => onOpenChange(false));

    const isPublished = project?.deployment?.status === "success";
    const productionUrl = project?.productionProjectUrl;

    /** See the header: keeping this out of the poll's deps is the whole fix. */
    const onChangedRef = React.useRef(onChanged);
    React.useEffect(() => {
        onChangedRef.current = onChanged;
    }, [onChanged]);

    React.useEffect(() => {
        setDomain(project?.customDomain ?? null);
    }, [project?.customDomain]);

    React.useEffect(() => {
        if (!open) setHostname("");
    }, [open]);

    const settling = isDomainSettling(domain);

    /**
     * One read of the project (there is no dedicated domain-status endpoint),
     * shared by the interval and the "Check now" button so both reschedule the
     * countdown the same way.
     */
    const mounted = React.useRef(true);
    React.useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const checkNow = React.useCallback(async () => {
        setChecking(true);
        const response = await vcaasApi.projects.get(projectId);
        if (!mounted.current) return;

        setChecking(false);
        setNextCheckAt(Date.now() + POLL_INTERVAL_MS);

        if (response.ok && response.data) {
            setDomain(response.data.customDomain ?? null);
            onChangedRef.current();
        }
    }, [projectId]);

    /**
     * Poll while the domain is settling, and stop the moment the status is
     * terminal — an `active` domain costs nothing to keep on screen.
     */
    React.useEffect(() => {
        if (!open || !settling) {
            setNextCheckAt(null);
            return;
        }

        setNextCheckAt(Date.now() + POLL_INTERVAL_MS);

        const timer = setInterval(() => {
            // A background tab is not watching; it can catch up when it returns.
            if (document.hidden) return;
            void checkNow();
        }, POLL_INTERVAL_MS);

        return () => clearInterval(timer);
    }, [open, settling, checkNow]);

    /**
     * The one-second clock behind the countdown and the elapsed timer. It runs ONLY
     * while an open modal is watching something move, so a live domain — or a
     * closed modal — schedules nothing.
     */
    React.useEffect(() => {
        if (!open || !settling) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [open, settling]);

    const normalised = hostname.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const hostnameValid = HOSTNAME_REGEX.test(normalised);

    async function handleSave(event: React.FormEvent) {
        event.preventDefault();
        if (!hostnameValid || saving) return;

        setSaving(true);
        const response = await vcaasApi.domain.set(projectId, { hostname: normalised });
        setSaving(false);

        if (response.ok) {
            toast.success(t("workspace.domain.saved"));
            setHostname("");
            onChanged();
            // H1 — a domain slot has just been taken.
            void refreshCapabilities();
            const refreshed = await vcaasApi.projects.get(projectId);
            if (refreshed.ok && refreshed.data) setDomain(refreshed.data.customDomain ?? null);
        } else {
            toast.error(t("workspace.domain.saveFailed"), { description: response.error || undefined });
        }
    }

    async function handleRemove() {
        const response = await vcaasApi.domain.remove(projectId);

        if (!response.ok) {
            toast.error(t("workspace.domain.removeFailed"), { description: response.error || undefined });
            throw new Error(response.error || "remove failed");
        }

        toast.success(t("workspace.domain.removed"));
        setDomain(null);
        onChanged();
        // H1 — the slot is free again.
        void refreshCapabilities();
    }

    const progress = getDomainProgress(domain);
    const hasRecords = (domain?.dnsRecordsToAdd?.length ?? 0) > 0;
    /** The records are still the user's move — the one state this screen shouts about. */
    const needsRecords = progress?.steps[0].state === "active" && hasRecords;

    return (
        <>
            <Modal
                open={open}
                onOpenChange={guard.onOpenChange}
                /* ⚠️ DO NOT ADD `dismissible={!isDirty}` HERE. `dismissible={false}`
                   makes the Modal `preventDefault()` the ESC/overlay events, so Radix
                   never fires `onOpenChange` — and the dirty guard, which works BY
                   intercepting that call, never runs. The result is a modal that
                   silently ignores Escape with no explanation, which is worse than
                   either behaviour on its own. The guard is the whole mechanism. */
                size="lg"
                title={t("workspace.domain.title")}
                description={t("workspace.domain.description")}
            >
                {/*
                  ⚠️ THE PAID GATE. A free account sees what a custom domain does and a
                  concrete upgrade CTA — never a hidden or dead control. The server
                  refuses `PUT /domain` independently (`requirePaidPlan`).
                */}
                <PaidFeature feature="customDomain" projectId={projectId}>
                    <div className="space-y-4">
                        {/* ⭐ FEATURE H1 — "1 of 4 projects using custom domains". */}
                        <CapabilityUsage capability="customDomain" projectId={projectId} />

                        {/* The current production URL, so it is obvious what the domain replaces. */}
                        {productionUrl && (
                            <div className="border-border bg-muted/40 rounded-lg border p-3">
                                <p className="text-muted-foreground text-xs">
                                    {t("workspace.domain.currentUrl")}
                                </p>
                                <div className="mt-1 flex items-center gap-1">
                                    <code className="min-w-0 flex-1 truncate font-mono text-xs">
                                        {productionUrl.replace(/^https?:\/\//, "")}
                                    </code>
                                    <CopyButton value={productionUrl} />
                                </div>
                            </div>
                        )}

                        {domain?.hostname ? (
                            // ── An attached domain ────────────────────────────
                            <div className="space-y-3">
                                <div className="border-border rounded-lg border p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <GlobeIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                                        <code className="min-w-0 flex-1 truncate font-mono text-sm font-medium">
                                            {domain.hostname}
                                        </code>
                                        {progress && (
                                            <StatusPill
                                                tone={progress.tone}
                                                dot
                                                pulse={progress.isSettling}
                                            >
                                                {t(progress.labelKey)}
                                            </StatusPill>
                                        )}
                                        {domain.status === "active" && (
                                            <Button variant="ghost" size="icon" className="size-7" asChild>
                                                <a
                                                    href={`https://${domain.hostname}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    aria-label={t("common.openInNewTab")}
                                                >
                                                    <ExternalLinkIcon className="size-3.5" aria-hidden />
                                                </a>
                                            </Button>
                                        )}
                                    </div>

                                    {/* What to DO about this status — not just what it is. */}
                                    {progress && (
                                        <p className="text-muted-foreground mt-2 text-xs">
                                            {t(progress.helpKey)}
                                        </p>
                                    )}
                                </div>

                                {/*
                                  ── PROPAGATION ──────────────────────────────
                                  ⭐ ABOVE THE RECORDS ON PURPOSE. The records are
                                  what you act on; this is whether you still need to.
                                  A live domain gets no stepper at all — there is
                                  nothing left to watch.
                                */}
                                {progress && !progress.isLive && (
                                    <DomainProgressPanel
                                        domain={domain}
                                        nextCheckInMs={
                                            nextCheckAt === null ? null : nextCheckAt - now
                                        }
                                        checking={checking}
                                        onCheckNow={() => void checkNow()}
                                        now={now}
                                        recordsBelow={hasRecords}
                                    />
                                )}

                                {/*
                                  ── DNS records ────────────────────────────
                                  ⭐ THE ONLY PART OF THIS SCREEN THE USER CAN ACT
                                  ON, and it used to read like a reference table
                                  sitting under a paragraph of status. While the
                                  records are outstanding the heading says so, in
                                  the same amber the strip above uses — a domain
                                  does nothing at all until these are added, and
                                  people were closing this dialog without knowing
                                  that was still their job.
                                */}
                                {domain.dnsRecordsToAdd && domain.dnsRecordsToAdd.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-sm font-medium">
                                                {needsRecords
                                                    ? t("workspace.domain.dnsTitleRequired", {
                                                          count: domain.dnsRecordsToAdd.length,
                                                      })
                                                    : t("workspace.domain.dnsTitle")}
                                            </h3>
                                            {needsRecords && (
                                                <StatusPill tone="warning" dot pulse>
                                                    {t("workspace.domain.dnsActionRequired")}
                                                </StatusPill>
                                            )}
                                        </div>
                                        <p className="text-muted-foreground text-xs">
                                            {needsRecords
                                                ? t("workspace.domain.dnsDescriptionRequired")
                                                : t("workspace.domain.dnsDescription")}
                                        </p>

                                        <div className="border-border overflow-x-auto rounded-lg border">
                                            <table className="w-full border-collapse text-xs">
                                                <thead className="bg-muted/60">
                                                    <tr>
                                                        <th scope="col" className="px-2.5 py-1.5 text-left font-medium">
                                                            {t("workspace.domain.dnsType")}
                                                        </th>
                                                        <th scope="col" className="px-2.5 py-1.5 text-left font-medium">
                                                            {t("workspace.domain.dnsName")}
                                                        </th>
                                                        <th scope="col" className="px-2.5 py-1.5 text-left font-medium">
                                                            {t("workspace.domain.dnsValue")}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {domain.dnsRecordsToAdd.map((record, index) => (
                                                        <tr key={index} className="border-border/60 border-t">
                                                            <td className="px-2.5 py-1.5 font-mono">{record.type}</td>
                                                            <td className="px-2.5 py-1.5">
                                                                <span className="flex items-center gap-1">
                                                                    <code className="min-w-0 truncate font-mono">
                                                                        {record.name}
                                                                    </code>
                                                                    <CopyButton value={record.name} />
                                                                </span>
                                                            </td>
                                                            <td className="px-2.5 py-1.5">
                                                                <span className="flex items-center gap-1">
                                                                    <code className="min-w-0 truncate font-mono">
                                                                        {record.value}
                                                                    </code>
                                                                    <CopyButton value={record.value} />
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                                            <TriangleAlertIcon className="mt-px size-3 shrink-0" aria-hidden />
                                            {t("workspace.deploy.dnsNotice")}
                                        </p>
                                    </div>
                                )}

                                {/*
                                  Removing is NOT gated — see `GATED_ROUTES` in @/lib/plan.
                                  A user whose plan lapsed must still be able to detach their
                                  own domain.
                                */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() => setRemoving(true)}
                                >
                                    {t("workspace.domain.remove")}
                                </Button>
                            </div>
                        ) : !isPublished ? (
                            // ── The "deploy first" guard ──────────────────────
                            <div className="border-warning/40 bg-warning-subtle text-warning-subtle-foreground rounded-lg border p-4 text-center">
                                <RocketIcon className="mx-auto mb-2 size-5" aria-hidden />
                                <p className="text-sm font-medium">{t("workspace.domain.deployFirstTitle")}</p>
                                <p className="mt-1 text-xs">{t("workspace.domain.deployFirstDescription")}</p>
                            </div>
                        ) : (
                            // ── Attach a domain ───────────────────────────────
                            <form onSubmit={handleSave} className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="domain-hostname" className="text-xs">
                                        {t("workspace.domain.hostnameLabel")}
                                    </Label>
                                    <Input
                                        id="domain-hostname"
                                        value={hostname}
                                        onChange={event => setHostname(event.target.value)}
                                        placeholder="app.example.com"
                                        autoComplete="off"
                                        spellCheck={false}
                                        aria-invalid={isDirty && !hostnameValid}
                                        className={cn(
                                            "h-8 font-mono text-xs",
                                            isDirty && !hostnameValid && "border-destructive"
                                        )}
                                    />
                                    {isDirty && !hostnameValid ? (
                                        <p className="text-destructive text-xs">
                                            {t("workspace.domain.hostnameInvalid")}
                                        </p>
                                    ) : (
                                        <p className="text-muted-foreground text-xs">
                                            {t("workspace.domain.hostnameHint")}
                                        </p>
                                    )}
                                </div>

                                <Button type="submit" size="sm" disabled={!hostnameValid || saving}>
                                    {saving ? (
                                        <LoaderIcon className="size-4 animate-spin" aria-hidden />
                                    ) : (
                                        <CheckCircle2Icon className="size-4" aria-hidden />
                                    )}
                                    {t("workspace.domain.save")}
                                </Button>
                            </form>
                        )}
                    </div>
                </PaidFeature>
            </Modal>

            {guard.confirmDialog}

            <ConfirmDialog
                open={removing}
                onOpenChange={setRemoving}
                tone="danger"
                title={t("workspace.domain.removeTitle", { name: domain?.hostname ?? "" })}
                description={t("workspace.domain.removeDescription")}
                confirmLabel={t("workspace.domain.remove")}
                onConfirm={handleRemove}
            />
        </>
    );
}
