"use client";

import * as React from "react";
import {
    AlertCircleIcon,
    CheckIcon,
    CopyIcon,
    DownloadIcon,
    LoaderIcon,
    ShieldAlertIcon,
    TriangleAlertIcon,
    UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyButton, Modal, StatusPill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import { vcaasApi } from "@/lib/vcaas";
import { writeOperation } from "@/lib/project-operation";
import {
    CLONE_COST,
    CLONE_STEPS,
    TRANSFER_COSTS,
    errorKeyFor,
    hasCreatedProject,
    isBusyPhase,
    isStepComplete,
    looksLikeImportCode,
    suggestCopyName,
    type TransferPhase,
} from "@/lib/project-transfer";
import {
    PROJECT_SLUG_MAX_LENGTH,
    slugify,
    validateProjectSlug,
} from "@/lib/project-slug";
/**
 * ⚠️ INLINED RATHER THAN IMPORTED. In totalum-platform this map lives in
 * `CreateProjectDialog`, a 700-line component this app does not have — copying the whole
 * dialog to reach five strings would be the wrong kind of faithful. The keys themselves
 * are the platform's, so the copy below still reads from the same dictionary.
 */
const PROBLEM_KEYS: Record<
    "empty" | "too-short" | "too-long" | "invalid-format" | "reserved",
    TranslationKey
> = {
    empty: "pages.projects.nameErrorEmpty",
    "too-short": "pages.projects.nameErrorTooShort",
    "too-long": "pages.projects.nameErrorTooLong",
    "invalid-format": "pages.projects.nameErrorFormat",
    reserved: "pages.projects.nameErrorReserved",
};
import { cn } from "@/lib/utils";

/**
 * ═══ EXPORT · IMPORT · CLONE (Feature H8) ═══════════════════════════════════
 *
 * Three dialogs over the two VCaaS transfer primitives. The rules — costs,
 * phases, error mapping, name suggestion — live in `@/lib/project-transfer` so
 * they are testable; this file is the UI over them.
 *
 * ── WHAT EVERY ONE OF THEM HAS TO GET RIGHT ─────────────────────────────────
 *
 * ⚠️ **THE COST IS STATED BEFORE THE BUTTON, NEVER AFTER.** These are the only
 * actions in the product that can spend 9 credits in one click.
 *
 * ⚠️ **NO AUTO-RETRY, ANYWHERE.** Both endpoints allow 1 call per minute and 5
 * per hour. A retry loop turns a recoverable failure into an hour of
 * `*_LIMIT_REACHED`. Every failure ends with a button the USER presses.
 *
 * ⚠️ **A FAILED CLONE SAYS WHETHER A PROJECT EXISTS.** `hasCreatedProject`
 * answers it definitively; the copy links straight to the half-built project so
 * it is never an orphan the user has to hunt for.
 *
 * ⚠️ **THE IMPORT CODE IS A BEARER CREDENTIAL.** It is masked until asked for,
 * carries an explicit warning, and is never logged or put in a URL.
 */

// ─────────────────────────────── Shared bits ────────────────────────────────

/** "Costs N credits" — always rendered next to the control that spends them. */
function CostNotice({ credits, detailKey }: { credits: number; detailKey?: TranslationKey }) {
    const t = useT();
    return (
        <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <AlertCircleIcon className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
                {t("transfer.cost", { credits: String(credits) })}
                {detailKey ? ` ${t(detailKey)}` : ""}
            </span>
        </p>
    );
}

/** A failure, with the specific reason and no dead end. */
function TransferError({
    code,
    message,
    onRetry,
    retryLabelKey = "common.retry",
}: {
    code: string | null;
    message: string | null;
    onRetry?: () => void;
    retryLabelKey?: TranslationKey;
}) {
    const t = useT();
    const key = errorKeyFor(code);

    return (
        <div className="border-destructive/30 bg-destructive/5 space-y-2 rounded-lg border p-3">
            <p className="text-destructive flex items-start gap-2 text-xs">
                <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                {/* A mapped key when we have advice; the server's own words when we
                    do not. Never a bare "failed". */}
                <span>{key ? t(key) : message || t("common.unexpectedError")}</span>
            </p>
            {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                    {t(retryLabelKey)}
                </Button>
            )}
        </div>
    );
}

/** The step rail shared by clone and import. */
function StepRail({ current }: { current: TransferPhase }) {
    const t = useT();
    return (
        <ol className="space-y-1.5">
            {CLONE_STEPS.map(step => {
                const done = isStepComplete(step.phase, current);
                const active = current === step.phase;
                return (
                    <li key={step.phase} className="flex items-center gap-2 text-xs">
                        <span
                            className={cn(
                                "flex size-4 shrink-0 items-center justify-center rounded-full border",
                                done && "border-success bg-success text-success-foreground",
                                active && "border-primary text-primary",
                                !done && !active && "border-border text-muted-foreground"
                            )}
                        >
                            {done ? (
                                <CheckIcon className="size-2.5" aria-hidden />
                            ) : active ? (
                                <LoaderIcon className="size-2.5 animate-spin" aria-hidden />
                            ) : null}
                        </span>
                        <span className={cn(active ? "font-medium" : "text-muted-foreground")}>
                            {t(step.labelKey)}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

/**
 * "A project was created" — the answer to the brief's partial-failure question.
 * Always links to it, so a half-built clone is never an orphan.
 */
function PartialProjectNotice({ slug }: { slug: string }) {
    const t = useT();
    return (
        <p className="border-warning/40 bg-warning-subtle text-warning-subtle-foreground flex items-start gap-2 rounded-lg border p-2.5 text-xs">
            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
                {t("transfer.partialCreated", { project: slug })}{" "}
                <Link href={`/project/${encodeURIComponent(slug)}`} className="underline underline-offset-2">
                    {t("transfer.openIt")}
                </Link>
            </span>
        </p>
    );
}

/** Pull `{ code, message }` out of our proxy envelope. */
function failureOf(response: {
    ok: boolean;
    error?: string | null;
    code?: string | null;
    upstreamCode?: string | null;
}) {
    /**
     * ⚠️ `upstreamCode` FIRST. `ERROR_KEYS` is keyed on VCaaS's own codes — the ones the
     * proxy keeps in `upstreamCode` — while `code` is the small stable union that
     * flattens everything unrecognised to `UNKNOWN`. Reading `code` alone meant every
     * mapped message here except the handful in the union was silently unreachable, and
     * the user saw the raw API sentence instead.
     */
    return { code: response.upstreamCode ?? response.code ?? null, message: response.error ?? null };
}

// ────────────────────────────────── Export ──────────────────────────────────

export interface ExportProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
}

export function ExportProjectDialog({ open, onOpenChange, projectId }: ExportProjectDialogProps) {
    const t = useT();
    const [includeRecords, setIncludeRecords] = React.useState(false);
    const [phase, setPhase] = React.useState<TransferPhase>("idle");
    const [code, setCode] = React.useState<string | null>(null);
    const [revealed, setRevealed] = React.useState(false);
    const [failure, setFailure] = React.useState<{ code: string | null; message: string | null } | null>(null);

    // Reset when it reopens — a stale import code from a previous export must not
    // be sitting there when someone opens this for a different project.
    React.useEffect(() => {
        if (!open) return;
        setPhase("idle");
        setCode(null);
        setRevealed(false);
        setFailure(null);
    }, [open, projectId]);

    async function runExport() {
        setPhase("exporting");
        setFailure(null);

        const response = await vcaasApi.projects.exportProject(projectId, { includeRecords });

        if (!response.ok || !response.data?.importCode) {
            setPhase("failed");
            setFailure(failureOf(response));
            return;
        }

        setCode(response.data.importCode);
        setPhase("done");
    }

    const busy = isBusyPhase(phase);

    return (
        <Modal
            open={open}
            onOpenChange={next => {
                if (!busy) onOpenChange(next);
            }}
            size="lg"
            title={t("transfer.export.title")}
            description={t("transfer.export.description")}
        >
            <div className="space-y-4">
                {phase !== "done" && (
                    <>
                        {/*
                          ⚠️ WHAT IT DOES *NOT* INCLUDE IS THE IMPORTANT HALF.
                          The export deliberately omits secrets, auth users and
                          tokens; someone who assumes otherwise would hand over a
                          code believing it carries no credentials, or expect a
                          clone to come up already configured.
                        */}
                        <div className="border-border bg-muted/40 space-y-2 rounded-lg border p-3">
                            <p className="text-xs font-medium">{t("transfer.export.includesTitle")}</p>
                            <ul className="text-muted-foreground space-y-1 text-xs">
                                <li>· {t("transfer.export.includes1")}</li>
                                <li>· {t("transfer.export.includes2")}</li>
                            </ul>
                            <p className="pt-1 text-xs font-medium">{t("transfer.export.excludesTitle")}</p>
                            <ul className="text-muted-foreground space-y-1 text-xs">
                                <li>· {t("transfer.export.excludes1")}</li>
                                <li>· {t("transfer.export.excludes2")}</li>
                            </ul>
                        </div>

                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <Label htmlFor="export-records" className="text-xs">
                                    {t("transfer.export.includeRecords")}
                                </Label>
                                <p className="text-muted-foreground mt-0.5 text-xs">
                                    {t("transfer.export.includeRecordsHint")}
                                </p>
                            </div>
                            <Switch
                                id="export-records"
                                checked={includeRecords}
                                onCheckedChange={setIncludeRecords}
                                disabled={busy}
                            />
                        </div>

                        <CostNotice credits={TRANSFER_COSTS.export} detailKey="transfer.export.rateLimit" />
                    </>
                )}

                {phase === "exporting" && (
                    <p className="text-muted-foreground flex items-center gap-2 text-xs">
                        <LoaderIcon className="size-3.5 animate-spin" aria-hidden />
                        {t("transfer.export.running")}
                    </p>
                )}

                {phase === "failed" && (
                    <TransferError
                        code={failure?.code ?? null}
                        message={failure?.message ?? null}
                        onRetry={() => void runExport()}
                    />
                )}

                {/* ── The result ────────────────────────────────────────── */}
                {phase === "done" && code && (
                    <div className="space-y-3">
                        <StatusPill tone="success" dot>
                            {t("transfer.export.ready")}
                        </StatusPill>

                        <div className="space-y-1.5">
                            <Label className="text-xs">{t("transfer.export.codeLabel")}</Label>
                            <div className="flex items-center gap-1.5">
                                <code className="border-border bg-muted/60 min-w-0 flex-1 truncate rounded-md border px-2 py-1.5 font-mono text-xs">
                                    {revealed ? code : "•".repeat(28)}
                                </code>
                                <Button variant="outline" size="sm" onClick={() => setRevealed(v => !v)}>
                                    {t(revealed ? "transfer.export.hide" : "transfer.export.reveal")}
                                </Button>
                                <CopyButton value={code} />
                            </div>
                        </div>

                        {/* ⚠️ It is a bearer credential. Say so, plainly. */}
                        <p className="border-warning/40 bg-warning-subtle text-warning-subtle-foreground flex items-start gap-2 rounded-lg border p-2.5 text-xs">
                            <ShieldAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                            <span>{t("transfer.export.secretWarning")}</span>
                        </p>
                    </div>
                )}

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                        {t(phase === "done" ? "common.close" : "common.cancel")}
                    </Button>
                    {phase !== "done" && (
                        <Button onClick={() => void runExport()} disabled={busy}>
                            {busy && <LoaderIcon className="size-4 animate-spin" aria-hidden />}
                            <DownloadIcon className="size-4" aria-hidden />
                            {t("transfer.export.action")}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}

// ────────────────────────────────── Import ──────────────────────────────────

export interface ImportProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The caller's own project slugs — the availability check, as in creation. */
    takenNames: ReadonlySet<string>;
    onImported: () => void;
}

export function ImportProjectDialog({
    open,
    onOpenChange,
    takenNames,
    onImported,
}: ImportProjectDialogProps) {
    const t = useT();
    const [code, setCode] = React.useState("");
    const [name, setName] = React.useState("");
    const transfer = useTransferRun();

    React.useEffect(() => {
        if (!open) return;
        setCode("");
        setName("");
        transfer.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const slugProblem = name ? validateProjectSlug(name) : null;
    const isMine = !slugProblem && takenNames.has(name);
    // ⚠️ Validate the CODE before anything is created or charged.
    const codeLooksRight = looksLikeImportCode(code);
    const canStart = codeLooksRight && !!name && !slugProblem && !isMine && !transfer.busy;

    async function run() {
        await transfer.runImport({ importCode: code.trim(), targetName: name, create: true });
        onImported();
    }

    return (
        <Modal
            open={open}
            onOpenChange={next => {
                if (!transfer.busy) onOpenChange(next);
            }}
            size="lg"
            title={t("transfer.import.title")}
            description={t("transfer.import.description")}
        >
            <div className="space-y-4">
                {transfer.phase === "idle" || transfer.phase === "failed" ? (
                    <>
                        <div className="space-y-1.5">
                            <Label htmlFor="import-code" className="text-xs">
                                {t("transfer.import.codeLabel")}
                            </Label>
                            <Input
                                id="import-code"
                                value={code}
                                onChange={event => setCode(event.target.value)}
                                placeholder="my-app-export-project-….zip"
                                spellCheck={false}
                                className="font-mono text-xs"
                            />
                            {code && !codeLooksRight && (
                                <p className="text-destructive text-xs">{t("transfer.import.codeInvalid")}</p>
                            )}
                        </div>

                        <NameField
                            value={name}
                            onChange={setName}
                            problem={slugProblem}
                            isMine={isMine}
                            disabled={transfer.busy}
                        />

                        <CostNotice
                            credits={TRANSFER_COSTS.createProject + TRANSFER_COSTS.import}
                            detailKey="transfer.import.costDetail"
                        />
                    </>
                ) : null}

                {transfer.busy && <StepRail current={transfer.phase} />}

                {transfer.phase === "failed" && (
                    <>
                        <TransferError
                            code={transfer.failure?.code ?? null}
                            message={transfer.failure?.message ?? null}
                        />
                        {hasCreatedProject(transfer.phase, transfer.createdSlug) && (
                            <PartialProjectNotice slug={transfer.createdSlug!} />
                        )}
                    </>
                )}

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={transfer.busy}>
                        {t("common.cancel")}
                    </Button>
                    {transfer.phase !== "done" && (
                        <Button onClick={() => void run()} disabled={!canStart}>
                            {transfer.busy && <LoaderIcon className="size-4 animate-spin" aria-hidden />}
                            <UploadIcon className="size-4" aria-hidden />
                            {t("transfer.import.action")}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}

// ────────────────────────────────── Clone ───────────────────────────────────

export interface CloneProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    takenNames: ReadonlySet<string>;
    onCloned: () => void;
}

export function CloneProjectDialog({
    open,
    onOpenChange,
    projectId,
    takenNames,
    onCloned,
}: CloneProjectDialogProps) {
    const t = useT();
    const [name, setName] = React.useState("");
    const [includeRecords, setIncludeRecords] = React.useState(true);
    const transfer = useTransferRun();

    React.useEffect(() => {
        if (!open) return;
        setName(suggestCopyName(projectId, takenNames));
        setIncludeRecords(true);
        transfer.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, projectId]);

    const slugProblem = name ? validateProjectSlug(name) : null;
    const isMine = !slugProblem && takenNames.has(name);
    const canStart = !!name && !slugProblem && !isMine && !transfer.busy;

    async function run() {
        await transfer.runClone({ sourceProjectId: projectId, targetName: name, includeRecords });
        onCloned();
    }

    return (
        <Modal
            open={open}
            onOpenChange={next => {
                if (!transfer.busy) onOpenChange(next);
            }}
            size="lg"
            title={t("transfer.clone.title")}
            description={t("transfer.clone.description", { project: projectId })}
        >
            <div className="space-y-4">
                {transfer.phase === "idle" || transfer.phase === "failed" ? (
                    <>
                        <NameField
                            value={name}
                            onChange={setName}
                            problem={slugProblem}
                            isMine={isMine}
                            disabled={transfer.busy}
                        />

                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <Label htmlFor="clone-records" className="text-xs">
                                    {t("transfer.clone.includeRecords")}
                                </Label>
                                <p className="text-muted-foreground mt-0.5 text-xs">
                                    {t("transfer.clone.includeRecordsHint")}
                                </p>
                            </div>
                            <Switch
                                id="clone-records"
                                checked={includeRecords}
                                onCheckedChange={setIncludeRecords}
                                disabled={transfer.busy}
                            />
                        </div>

                        {/*
                          ⭐ NINE CREDITS, AND THE BREAKDOWN IS SHOWN.
                          A clone is export (2) + create (1) + import (6). The brief
                          says to be honest that it costs "both operations"; it is
                          actually three, and quoting 8 would under-state the price
                          of the flow people reach for most.
                        */}
                        <CostNotice credits={CLONE_COST} detailKey="transfer.clone.costBreakdown" />

                        <p className="text-muted-foreground text-xs">{t("transfer.clone.duration")}</p>
                    </>
                ) : null}

                {transfer.busy && <StepRail current={transfer.phase} />}

                {transfer.phase === "failed" && (
                    <>
                        <TransferError
                            code={transfer.failure?.code ?? null}
                            message={transfer.failure?.message ?? null}
                        />
                        {hasCreatedProject(transfer.phase, transfer.createdSlug) ? (
                            <PartialProjectNotice slug={transfer.createdSlug!} />
                        ) : (
                            /* Nothing was created — say that too, so nobody hunts
                               their project list for a half-made copy. */
                            <p className="text-muted-foreground text-xs">{t("transfer.nothingCreated")}</p>
                        )}
                    </>
                )}

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={transfer.busy}>
                        {t("common.cancel")}
                    </Button>
                    {transfer.phase !== "done" && (
                        <Button onClick={() => void run()} disabled={!canStart}>
                            {transfer.busy && <LoaderIcon className="size-4 animate-spin" aria-hidden />}
                            <CopyIcon className="size-4" aria-hidden />
                            {t("transfer.clone.action")}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}

// ─────────────────────────── Shared sub-components ──────────────────────────

function NameField({
    value,
    onChange,
    problem,
    isMine,
    disabled,
}: {
    value: string;
    onChange: (next: string) => void;
    problem: ReturnType<typeof validateProjectSlug>;
    isMine: boolean;
    disabled: boolean;
}) {
    const t = useT();
    return (
        <div className="space-y-1.5">
            <Label htmlFor="transfer-name" className="text-xs">
                {t("transfer.nameLabel")}
            </Label>
            <Input
                id="transfer-name"
                value={value}
                /* Same slugify-on-type as normal creation, so the two flows cannot
                   disagree about what a legal name is. */
                onChange={event => onChange(slugify(event.target.value))}
                maxLength={PROJECT_SLUG_MAX_LENGTH}
                spellCheck={false}
                disabled={disabled}
                className="font-mono text-sm"
            />
            {problem && <p className="text-destructive text-xs">{t(PROBLEM_KEYS[problem])}</p>}
            {isMine && <p className="text-destructive text-xs">{t("transfer.nameTaken")}</p>}
        </div>
    );
}

// ──────────────────────────────── The runner ────────────────────────────────

/**
 * The shared state machine behind import and clone.
 *
 * ⚠️ IT NEVER AUTO-RETRIES. Every failure is terminal until the user acts —
 * see the rate-limit note at the top of the file.
 */
function useTransferRun() {
    const t = useT();
    const router = useRouter();
    const [phase, setPhase] = React.useState<TransferPhase>("idle");
    const [createdSlug, setCreatedSlug] = React.useState<string | null>(null);
    const [failure, setFailure] = React.useState<{ code: string | null; message: string | null } | null>(null);

    function reset() {
        setPhase("idle");
        setCreatedSlug(null);
        setFailure(null);
    }

    /**
     * ═══⭐⭐ THE IMPORT HAS STARTED — HAND IT TO THE WORKSPACE ══════════════
     *
     * ⚠️⚠️ THIS REPLACED A POLL LOOP INSIDE THE DIALOG, AND THE REPLACEMENT IS THE
     * POINT. The old flow watched the target project from here for up to twelve
     * minutes and then showed "Ready" or "we stopped watching" — which meant the
     * progress lived in a modal that **died on reload**. Refresh mid-clone and there
     * was nothing at all: no loader, no explanation, and a workspace that looked idle
     * over a project being rebuilt underneath it.
     *
     * The workspace's import overlay is now the single place a running import is
     * shown, and it survives a reload because it reads the server's own import lock
     * (`project.importInProgress`) rather than this component's state.
     *
     * ⚠️ THE STAMP IS WRITTEN BEFORE THE NAVIGATION, not after. It is what makes the
     * overlay paint on the destination's FIRST frame instead of after its first
     * fetch; the server's `startedAt` then takes over, so a browser clock that is
     * slightly off corrects itself rather than skewing the whole wait.
     *
     * ⚠️ AND IT IS WRITTEN ONLY ONCE `POST …/import` HAS RETURNED 200 — the moment
     * the work genuinely exists and has been charged for. Stamping earlier would
     * paint a blocking overlay over a project whose import was refused.
     */
    function handOffToWorkspace(slug: string) {
        writeOperation(slug, { kind: "import", startedAt: Date.now() });
        setPhase("done");
        router.push(`/project/${encodeURIComponent(slug)}`);
    }

    async function runImport({
        importCode,
        targetName,
        create,
    }: {
        importCode: string;
        targetName: string;
        create: boolean;
    }) {
        setFailure(null);
        let slug = targetName;

        if (create) {
            setPhase("creating");
            const created = await vcaasApi.projects.create({
                projectId: targetName,
                description: t("transfer.createdDescription"),
            });
            if (!created.ok) {
                setPhase("failed");
                setFailure(failureOf(created));
                return;
            }
            /**
             * ⚠️ THE CREATED ID, NOT THE REQUESTED ONE. Outside production the
             * account backend renames a new project (`…111testdev`) so dev cannot
             * collide with live — importing into `targetName` would then be
             * importing into a project that does not exist. Identical in production.
             */
            slug = created.data?.projectId || targetName;
            setCreatedSlug(slug);
        }

        setPhase("importing");
        const imported = await vcaasApi.projects.importProject(slug, { importCode });
        if (!imported.ok) {
            setPhase("failed");
            setFailure(failureOf(imported));
            return;
        }

        handOffToWorkspace(slug);
    }

    async function runClone({
        sourceProjectId,
        targetName,
        includeRecords,
    }: {
        sourceProjectId: string;
        targetName: string;
        includeRecords: boolean;
    }) {
        setFailure(null);

        setPhase("exporting");
        const exported = await vcaasApi.projects.exportProject(sourceProjectId, { includeRecords });
        if (!exported.ok || !exported.data?.importCode) {
            setPhase("failed");
            setFailure(failureOf(exported));
            return;
        }

        await runImport({ importCode: exported.data.importCode, targetName, create: true });
    }

    return {
        phase,
        createdSlug,
        failure,
        busy: isBusyPhase(phase),
        reset,
        runImport,
        runClone,
    };
}
