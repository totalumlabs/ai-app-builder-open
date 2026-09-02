"use client";

import * as React from "react";
import {
    CheckCircle2Icon,
    DownloadIcon,
    ExternalLinkIcon,
    EyeIcon,
    EyeOffIcon,
    GithubIcon,
    LoaderIcon,
    ShieldAlertIcon,
    TriangleAlertIcon,
    GitBranchIcon,
} from "lucide-react";
import { ConfirmDialog, CopyButton, Modal, StatusPill } from "@/components/primitives";
import { PaidFeature, CapabilityUsage } from "@/components/plan/PaidFeature";
import { useCapabilities } from "@/components/plan/CapabilityProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/i18n";
import { parseGithubRepo, wasNormalized } from "@/lib/github-repo";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import { ServerWakeNotice } from "./ServerWakeNotice";
import { useServerWake } from "./use-server-wake";
import type { GithubEnv, GithubStatus, GithubSyncDirection } from "@/lib/vcaas-types";
import { cn } from "@/lib/utils";
import { useDirtyGuard } from "./use-dirty-guard";

/**
 * GITHUB SYNC — a PAID feature.
 *
 * ── THE TOKEN IS THE WHOLE RISK SURFACE ─────────────────────────────────────
 *
 * A GitHub personal access token is a live credential to someone's source code. It
 * is handled accordingly:
 *
 *   · the input is `type="password"` by default, so it is not captured by a screen
 *     share or a shoulder;
 *   · it is NEVER stored in this component beyond the submit, never logged, and
 *     never put in a toast or an error message;
 *   · the modal spells out the exact FINE-GRAINED permissions to grant, and links
 *     straight to the form that creates one — see the block above the repository
 *     field for why all three are required and why `repo` (a classic scope) was
 *     the wrong instruction;
 *   · `autoComplete="off"` keeps it out of the browser's password manager, where it
 *     would be saved as if it were a login.
 *
 * ⚠️ It is sent to VCaaS over our own proxy, which is HTTPS and session-gated. We
 * never see it again after that request — there is no "reveal token" affordance
 * because the token is not ours to hold.
 *
 * ── THE PULL IS NOT THIS MODAL'S ANY MORE ───────────────────────────────────
 *
 * `pull` returns immediately with `status: "pulling"` and the work continues on the
 * sandbox for minutes. This dialog used to own the request AND the 5-second poll —
 * ⚠️⚠️ WHICH DIED WITH THE DIALOG. The pull kept going; the polling did not, so
 * closing this (which is the obvious thing to do while you wait) meant never learning
 * that the pull had finished or failed, and nothing anywhere on the workspace said
 * the source was being replaced underneath the preview.
 *
 * The button stays here. The operation — its banner, its chat lock, its polling and
 * its survival across a reload — belongs to `WorkspaceShell`; see
 * `@/lib/project-operation`.
 */

const SYNC_DIRECTIONS: { value: GithubSyncDirection; labelKey: "workspace.github.dirToGithub" | "workspace.github.dirFromGithub" }[] = [
    { value: "totalum_to_github", labelKey: "workspace.github.dirToGithub" },
    { value: "github_to_totalum", labelKey: "workspace.github.dirFromGithub" },
];

export interface GithubModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    /** Lets the workspace header show the connected dot. */
    onStatusChange: (connected: boolean) => void;
    /**
     * ⭐ A PULL IS RUNNING — owned by the shell, so it is still true after this dialog
     * is closed and after the page is reloaded. It rewrites the project's files on the
     * sandbox, which is why the chat is locked and the visual editor refuses to open
     * for as long as it holds.
     */
    pulling?: boolean;
    /**
     * Starts one. The shell refuses (with a toast) if the project is already busy.
     *
     * ⚠️⚠️ ITS ABSENCE HIDES THE PULL BUTTON, AND THAT IS DELIBERATE. This dialog is
     * also opened from the DASHBOARD (`ConnectGithubButton`), where there is no
     * preview to go stale, no chat to pause and no banner to show — a three-minute
     * pull started from a popover there would be exactly the invisible operation this
     * work exists to end. Connecting a repository is what that surface is for;
     * pulling belongs in the project.
     */
    onPull?: () => void;
    /** Bumped by the shell when a pull SUCCEEDS — this re-reads the repository state. */
    pullSucceeded?: number;
    /**
     * Another long operation is in flight (a publish, a rebuild, a restart), as an
     * already-translated sentence. The button stays enabled and says this on click —
     * see the note on the `Pull` button.
     */
    blockedReason?: string | null;
}

/**
 * The four steps that produce a token this backend will actually accept.
 *
 * ⚠️ ITS OWN COMPONENT because it needs NOTHING — no project, no session, no plan.
 * Everything else in this modal needs all three, so splitting it out is what makes
 * the instructions renderable on their own; export it temporarily and mount it on a
 * page if you need to look at the wording without a paid account to hand.
 */
function GithubTokenSetup() {
    const t = useT();

    /*
     * ⭐ THE FOUR STEPS, IN FULL, ON THE SCREEN THAT NEEDS THEM. Everything a
     * person must know to produce a token that will actually be accepted, and
     * nothing else.
     *
     * ⚠️ IT SAID "GIVE IT THE `repo` SCOPE", AND THAT WAS WRONG. `repo` is a
     * CLASSIC token scope. `validateConnection` in
     * `totalum-backend/src/api/v1/github/github.service.ts` reads
     * `permissions.push`, `permissions.admin` and probes PR write — i.e. it
     * validates the three FINE-GRAINED permissions listed here. Following the old
     * copy produced a token that was refused with a permissions error this modal
     * could not explain, and the `ghp_…` placeholder reinforced it.
     *
     * ⚠️ ALL THREE PERMISSIONS ARE LOAD-BEARING — none is padding, and none may be
     * trimmed to look friendlier:
     *   · Contents       — push and pull the code itself;
     *   · Pull requests  — every deploy opens one (develop → main);
     *   · Administration — branch protection on both branches, which is what stops
     *                      a direct push to a protected branch.
     * Leaving one out fails at CONNECT time, with a list the user then has to
     * reconcile against a token page they have already closed.
     *
     * ⚠️ THE PERMISSION NAMES ARE NOT TRANSLATED, in either dictionary. They are
     * labels the user has to FIND on GitHub's own page, and a Spanish rendering of
     * "Pull requests" is a string that appears nowhere on it. They are `<code>`
     * for the same reason.
     */
    return (
        <div className="border-border rounded-lg border p-3">
            <p className="text-xs font-semibold">
                {t("workspace.github.setupTitle")}
            </p>

            <ol className="text-muted-foreground mt-1.5 list-decimal space-y-1 pl-4 text-xs">
                <li>
                    {t("workspace.github.setupStep1")}{" "}
                    {/*
                      ⚠️ `/new`, NOT the token LIST page. The list is
                      where the legacy docs pointed and it costs the
                      user a hunt for the right one of two "Generate
                      new token" menus — this link lands directly on
                      the fine-grained form.
                    */}
                    <a
                        href="https://github.com/settings/personal-access-tokens/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-medium underline underline-offset-2"
                    >
                        {t("workspace.github.setupLink")}
                        <ExternalLinkIcon
                            className="ml-0.5 inline size-3 align-[-1px]"
                            aria-hidden
                        />
                    </a>
                </li>
                <li>{t("workspace.github.setupStep2")}</li>
                <li>
                    {t("workspace.github.setupStep3")}
                    <span className="mt-1 flex flex-wrap gap-1">
                        {["Contents", "Pull requests", "Administration"].map(
                            permission => (
                                <code
                                    key={permission}
                                    className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[11px]"
                                >
                                    {permission}
                                </code>
                            )
                        )}
                    </span>
                </li>
                <li>{t("workspace.github.setupStep4")}</li>
            </ol>

            {/*
              The security line stays, shortened to what the user can
              act on: we do not keep it, and a leaked token is revoked
              on GitHub. It is the last line rather than a banner —
              the how-to is what people are here to read.
            */}
            <p className="text-muted-foreground mt-2 flex items-start gap-1.5 text-xs">
                <ShieldAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                {t("workspace.github.securityBody")}
            </p>
        </div>
    );
}

/**
 * ⭐ WHAT TOTALUM WILL DO TO YOUR REPOSITORY, before you go and make a token.
 *
 * ⚠️ THIS IS THE QUESTION PEOPLE ACTUALLY HAVE, and nothing answered it. The modal
 * asked for a token and a repository and said nothing about what happens next — so
 * the branch model was only discoverable by connecting and watching commits appear.
 * Someone who then cloned the repo and worked on `main`, which is the branch git
 * checks out by default, would have their work overwritten on the next publish with
 * no warning that this was ever a possibility.
 *
 * ── EVERY LINE HERE IS VERIFIED AGAINST `startum-github-integration.service.ts` ──
 * Not against the API docs, which are close but not exact:
 *
 *   · `commitChangesAfterAgentComplete` — commit + push to `develop` after each
 *     completed prompt.
 *   · `pullAndSyncBeforeAgentStart` — pulls `develop` BEFORE each prompt and merges
 *     with `--strategy-option=theirs`. **GitHub wins on conflict**, which is what
 *     makes working on `develop` safe rather than merely tolerated.
 *   · `createAndMergePROnPublish` — opens a PR from `develop` to `main` on publish
 *     and merges it. ⚠️ IF THAT PR CONFLICTS IT CLOSES IT AND **FORCE-UPDATES
 *     `main` TO MATCH `develop`** — the one genuinely destructive behaviour in the
 *     integration, and the reason the warning below is a warning and not a note.
 *
 * ⚠️ THE BRANCH NAMES ARE NOT TRANSLATED. `develop` and `main` are literals in the
 * service and the strings people type into `git checkout`; a Spanish reader needs
 * the exact word, not a translation of it. They are interpolated as `<code>`.
 */
function GithubWorkflowNote({ compact = false }: { compact?: boolean }) {
    const t = useT();

    return (
        <div
            className={cn(
                "border-info/30 bg-info-subtle text-info-subtle-foreground rounded-lg border p-3",
                compact && "p-2.5"
            )}
        >
            <p className="flex items-center gap-1.5 text-xs font-medium">
                <GitBranchIcon className="size-3.5 shrink-0" aria-hidden />
                {t("workspace.github.flowTitle")}
            </p>

            <ul className="mt-2 space-y-1.5 text-xs">
                <li className="flex gap-1.5">
                    <span aria-hidden>·</span>
                    <span>
                        {t("workspace.github.flowPrompt")} <Branch name="develop" />
                    </span>
                </li>
                <li className="flex gap-1.5">
                    <span aria-hidden>·</span>
                    <span>
                        {t("workspace.github.flowPublish")} <Branch name="develop" /> →{" "}
                        <Branch name="main" />
                    </span>
                </li>
                <li className="flex gap-1.5">
                    <span aria-hidden>·</span>
                    <span>
                        {t("workspace.github.flowPull")} <Branch name="develop" />
                    </span>
                </li>
            </ul>

            {/*
              ⚠️ SEPARATED AND STRONGER THAN THE LIST. The three lines above are
              information; this one is the thing that costs someone their work if
              they do not read it.
            */}
            <p className="border-info/25 mt-2.5 border-t pt-2 text-xs font-medium">
                {t("workspace.github.flowLocalWork")} <Branch name="develop" />.{" "}
                <span className="font-normal">
                    {t("workspace.github.flowMainWarning")} <Branch name="main" />
                    {t("workspace.github.flowMainWarningEnd")}
                </span>
            </p>
        </div>
    );
}

/** A branch name, never translated — it is what you type into `git checkout`. */
function Branch({ name }: { name: string }) {
    return (
        <code className="bg-info/10 rounded px-1 py-px font-mono text-[0.95em]">{name}</code>
    );
}

export function GithubModal({
    open,
    onOpenChange,
    projectId,
    onStatusChange,
    pulling = false,
    onPull,
    pullSucceeded = 0,
    blockedReason = null,
}: GithubModalProps) {
    const t = useT();
    const { refresh: refreshCapabilities } = useCapabilities();
    /** ⭐ Connecting needs the sandbox awake — see `use-server-wake.ts`. */
    const wake = useServerWake(projectId);

    const [status, setStatus] = React.useState<GithubStatus | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [token, setToken] = React.useState("");
    const [showToken, setShowToken] = React.useState(false);
    const [repository, setRepository] = React.useState("");

    /**
     * ⭐ `owner/name`, whatever they pasted. `null` while the field cannot be read
     * as a GitHub repository — which is also what disables the submit button, so a
     * hopeless value never costs a round trip.
     */
    const parsedRepo = React.useMemo(() => parseGithubRepo(repository), [repository]);
    const repoRewritten = wasNormalized(repository, parsedRepo);
    const repoInvalid = repository.trim().length > 0 && !parsedRepo;
    const [direction, setDirection] = React.useState<GithubSyncDirection>("totalum_to_github");
    const [connecting, setConnecting] = React.useState(false);
    const [disconnecting, setDisconnecting] = React.useState(false);
    const [env, setEnv] = React.useState<GithubEnv | null>(null);
    const [envOpen, setEnvOpen] = React.useState(false);
    const [envLoading, setEnvLoading] = React.useState(false);

    // A typed token is the thing that must not be lost silently.
    const isDirty = token.trim().length > 0 || repository.trim().length > 0;
    const guard = useDirtyGuard(isDirty, () => onOpenChange(false));

    const mounted = React.useRef(true);
    React.useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const loadStatus = React.useCallback(async () => {
        setLoading(true);
        const response = await vcaasApi.github.status(projectId);
        if (!mounted.current) return;

        if (response.ok && response.data) {
            setStatus(response.data);
            onStatusChange(!!response.data.connected);
        }
        setLoading(false);
    }, [projectId, onStatusChange]);

    React.useEffect(() => {
        if (open) void loadStatus();
        if (!open) {
            // Drop the token from memory the moment the modal closes.
            setToken("");
            setRepository("");
            setShowToken(false);
            setEnv(null);
            setEnvOpen(false);
        }
    }, [open, loadStatus]);

    /**
     * ⭐ A PULL THAT SUCCEEDED CHANGED THE REPOSITORY STATE, so re-read it.
     *
     * ⚠️ ONLY WHILE OPEN, and skipping the mount value. The pull is usually watched
     * with this dialog closed; asking for a status nobody is looking at is a paid,
     * plan-gated round trip, and the `open` effect above already refreshes on reopen.
     */
    const seenPullSucceeded = React.useRef(pullSucceeded);
    React.useEffect(() => {
        if (pullSucceeded === seenPullSucceeded.current) return;
        seenPullSucceeded.current = pullSucceeded;
        if (open) void loadStatus();
    }, [pullSucceeded, open, loadStatus]);

    async function handleConnect(event: React.FormEvent) {
        event.preventDefault();
        if (!token.trim() || !parsedRepo || connecting) return;

        setConnecting(true);
        const response = await vcaasApi.github.connect(projectId, {
            token: token.trim(),
            /**
             * ⚠️ THE PARSED VALUE, NOT THE RAW FIELD. The box accepts anything GitHub
             * puts on a clipboard — a clone URL, an SSH remote, a deep link to a file
             * — and `parseGithubRepo` reduces it to the `owner/name` the API stores.
             * Sending the raw text would forward `https://github.com/a/b.git` as a
             * repository name.
             */
            repositoryFullName: parsedRepo,
            syncDirection: direction,
        });
        setConnecting(false);

        // Clear the token whatever happened — success or failure, it has been sent
        // and there is no reason to keep a live credential in component state.
        setToken("");

        /**
         * ⭐ THE SANDBOX WAS ASLEEP, SO VCaaS STARTED IT AND REFUSED THE CONNECT.
         *
         * ⚠️ NO AUTO-RETRY, AND THE REASON IS THE LINE ABOVE: the token has just been
         * wiped from state, so there is nothing left to retry WITH. The strip tells the
         * user their server is coming up; they paste the token again when it is.
         * Re-prompting is the honest trade for never holding a live credential.
         */
        if (wake.claim(response)) {
            /**
             * ⚠️ A TOAST AS WELL AS THE STRIP, because this is the one case where the
             * user must ACT again — the token was wiped a few lines above, so nothing
             * can replay this for them. The strip explains the wait; the toast is what
             * they see if they were already looking away from the form.
             */
            toast.info(t("workspace.serverWake.title"), {
                description: t("workspace.serverWake.bodyRetry"),
            });
            return;
        }

        if (response.ok) {
            toast.success(t("workspace.github.connected"));
            setRepository("");
            await loadStatus();
            // H1 — a slot has just been taken; the count on screen must say so.
            void refreshCapabilities();
        } else {
            // `response.error` is our normalised message; it never contains the token.
            toast.error(t("workspace.github.connectFailed"), { description: response.error || undefined });
        }
    }

    /*
      ⚠️ `pollPullStatus` AND `handlePull` USED TO BE HERE, and both are now the
      shell's: `handleGithubPull` makes the request (including the synchronous
      `no_changes` answer, which is not an operation) and the one operation watcher
      polls `pull-status`. See the note at the top of this file for the bug that
      caused — a poll inside a dialog that is closed for the whole wait.
    */

    async function handleDisconnect() {
        const response = await vcaasApi.github.disconnect(projectId);

        if (!response.ok) {
            toast.error(t("workspace.github.disconnectFailed"), { description: response.error || undefined });
            throw new Error(response.error || "disconnect failed");
        }

        toast.success(t("workspace.github.disconnected"));
        setStatus(null);
        onStatusChange(false);
        await loadStatus();
        // H1 — the slot is free again, and the user may be about to reuse it here.
        void refreshCapabilities();
    }

    /**
     * ⚠️ IT IS A TOGGLE, AND IT ONLY FETCHES ONCE. These are SECRETS on screen — the
     * live database URL and the API keys — so the person who revealed them needs the
     * same control to put them away again, without closing the whole modal (which is
     * also where the repository and the disconnect button live). Re-fetching on every
     * reveal would spend a paid, gated round-trip to redisplay bytes we already hold.
     */
    async function toggleEnv() {
        if (envOpen) {
            setEnvOpen(false);
            return;
        }

        if (env) {
            setEnvOpen(true);
            return;
        }

        setEnvLoading(true);
        const response = await vcaasApi.github.env(projectId);
        setEnvLoading(false);

        if (response.ok && response.data) {
            setEnv(response.data);
            setEnvOpen(true);
        } else {
            toast.error(t("workspace.github.envFailed"), { description: response.error || undefined });
        }
    }

    const connected = !!status?.connected;

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
                title={t("workspace.github.title")}
                description={t("workspace.github.description")}
                headerAside={
                    connected ? (
                        <StatusPill tone="success" dot>
                            {t("workspace.github.statusConnected")}
                        </StatusPill>
                    ) : undefined
                }
            >
                <PaidFeature feature="github" projectId={projectId}>
                    <div className="space-y-4">
                        {/*
                          ⭐ FEATURE H1 — the honest number, on the screen where the
                          decision is made: "2 of 4 projects using GitHub sync". A
                          plan buys the capability on N projects, so someone about to
                          connect a third needs to know before they paste a token,
                          not after the server refuses it.
                        */}
                        <CapabilityUsage capability="github" projectId={projectId} />

                        {loading && !status && (
                            <div className="grid place-items-center py-8">
                                <LoaderIcon className="text-muted-foreground size-5 animate-spin" aria-hidden />
                            </div>
                        )}

                        {!loading && connected ? (
                            // ── Connected ─────────────────────────────────────
                            <div className="space-y-3">
                                <div className="border-border rounded-lg border p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <GithubIcon className="size-4 shrink-0" aria-hidden />
                                        <code className="min-w-0 flex-1 truncate font-mono text-sm font-medium">
                                            {status?.repositoryFullName}
                                        </code>
                                        {status?.repositoryFullName && (
                                            <Button variant="ghost" size="icon" className="size-7" asChild>
                                                <a
                                                    href={`https://github.com/${status.repositoryFullName}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    aria-label={t("common.openInNewTab")}
                                                >
                                                    <GithubIcon className="size-3.5" aria-hidden />
                                                </a>
                                            </Button>
                                        )}
                                    </div>

                                    {(status?.developBranch || status?.productionBranch) && (
                                        <p className="text-muted-foreground mt-1.5 font-mono text-xs">
                                            {status.developBranch} · {status.productionBranch}
                                        </p>
                                    )}

                                    {/* An expired or invalid token is the single most common
                                        failure, and it is invisible until a sync fails. */}
                                    {status && !status.tokenValid && (
                                        <p className="text-destructive mt-2 flex items-start gap-1.5 text-xs">
                                            <TriangleAlertIcon className="mt-px size-3 shrink-0" aria-hidden />
                                            {t(
                                                status.tokenExpired
                                                    ? "workspace.github.tokenExpired"
                                                    : "workspace.github.tokenInvalid"
                                            )}
                                        </p>
                                    )}
                                </div>

                                {/*
                                  ⚠️ SHOWN WHEN CONNECTED TOO, not only on the connect
                                  form. Someone who linked the repo last week and is
                                  only NOW about to clone it locally opens this panel —
                                  which is exactly the moment the `develop`-vs-`main`
                                  rule matters, and the connect form they read it on is
                                  no longer reachable.
                                */}
                                <GithubWorkflowNote compact />

                                <div className="flex flex-wrap gap-2">
                                    {/*
                                      ⚠️ DISABLED ONLY WHILE THE PULL ITSELF IS RUNNING.
                                      When something ELSE is (a publish, a rebuild, a
                                      restart) it stays pressable and names that instead
                                      — a greyed button with no explanation, in a dialog
                                      the user opened specifically to press it, is how
                                      "GitHub sync is broken" gets reported.
                                    */}
                                    {onPull && (
                                        <Button
                                            size="sm"
                                            disabled={pulling}
                                            onClick={() => {
                                                if (blockedReason) {
                                                    toast.info(blockedReason);
                                                    return;
                                                }
                                                onPull();
                                            }}
                                        >
                                            {pulling ? (
                                                <LoaderIcon
                                                    className="size-4 animate-spin"
                                                    aria-hidden
                                                />
                                            ) : (
                                                <DownloadIcon className="size-4" aria-hidden />
                                            )}
                                            {pulling
                                                ? t("workspace.github.pulling")
                                                : t("workspace.github.pull")}
                                        </Button>
                                    )}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={toggleEnv}
                                        disabled={envLoading}
                                        aria-expanded={envOpen}
                                    >
                                        {envLoading ? (
                                            <LoaderIcon className="size-4 animate-spin" aria-hidden />
                                        ) : envOpen ? (
                                            <EyeOffIcon className="size-4" aria-hidden />
                                        ) : (
                                            <EyeIcon className="size-4" aria-hidden />
                                        )}
                                        {t(envOpen ? "workspace.github.hideEnv" : "workspace.github.viewEnv")}
                                    </Button>

                                    {/* Disconnect is NOT plan-gated — a lapsed account must be
                                        able to detach its own repository. */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive ml-auto"
                                        onClick={() => setDisconnecting(true)}
                                    >
                                        {t("workspace.github.disconnect")}
                                    </Button>
                                </div>

                                {envOpen && env && (
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium">{t("workspace.github.envTitle")}</h3>
                                        <p className="text-muted-foreground text-xs">
                                            {t("workspace.github.envDescription")}
                                        </p>
                                        {(["envDev", "envProd"] as const).map(key => (
                                            <div key={key} className="border-border rounded-lg border">
                                                <div className="border-border/60 flex items-center justify-between border-b px-2.5 py-1.5">
                                                    <span className="text-muted-foreground font-mono text-xs">
                                                        {key === "envDev" ? ".env.development" : ".env.production"}
                                                    </span>
                                                    <CopyButton value={env[key] || ""} />
                                                </div>
                                                <pre className="tp-scroll max-h-40 overflow-auto p-2.5 font-mono text-[11px] break-all whitespace-pre-wrap">
                                                    {env[key]?.trim() || t("workspace.github.envEmpty")}
                                                </pre>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            !loading && (
                                // ── Connect ───────────────────────────────────
                                <form onSubmit={handleConnect} className="space-y-3">
                                    {/* ⭐ Inside the modal, so the wait is explained
                                        exactly where the button was pressed. */}
                                    {(wake.waking || wake.failed) && (
                                        <ServerWakeNotice wake={wake} manualRetry />
                                    )}
                                    {/*
                                      ⚠️ BEFORE `GithubTokenSetup`, DELIBERATELY. "What
                                      will this do to my repository?" is the question you
                                      have BEFORE you go to GitHub and mint a credential,
                                      not after.
                                    */}
                                    <GithubWorkflowNote />

                                    <GithubTokenSetup />

                                    <div className="space-y-1.5">
                                        <Label htmlFor="github-repo" className="text-xs">
                                            {t("workspace.github.repoLabel")}
                                        </Label>
                                        <Input
                                            id="github-repo"
                                            value={repository}
                                            onChange={event => setRepository(event.target.value)}
                                            placeholder="my-org/my-repo"
                                            autoComplete="off"
                                            spellCheck={false}
                                            aria-invalid={repoInvalid}
                                            className="h-8 font-mono text-xs"
                                        />

                                        {/*
                                          ⚠️ THE RESOLVED VALUE IS SHOWN BACK, and that
                                          is the point of accepting a URL at all: the
                                          user pasted 60 characters and we are sending
                                          15 of them, so we say which 15. Silently
                                          rewriting a field is how someone connects the
                                          wrong repository and cannot see why.
                                        */}
                                        {repoInvalid ? (
                                            <p className="text-destructive text-xs">
                                                {t("workspace.github.repoInvalid")}
                                            </p>
                                        ) : repoRewritten ? (
                                            <p className="text-muted-foreground text-xs">
                                                {t("workspace.github.repoResolved")}{" "}
                                                <span className="text-foreground font-mono">
                                                    {parsedRepo}
                                                </span>
                                            </p>
                                        ) : (
                                            <p className="text-muted-foreground text-xs">
                                                {t("workspace.github.repoHint")}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="github-token" className="text-xs">
                                            {t("workspace.github.tokenLabel")}
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="github-token"
                                                type={showToken ? "text" : "password"}
                                                value={token}
                                                onChange={event => setToken(event.target.value)}
                                                placeholder="github_pat_…"
                                                // Keep a live credential out of the browser's
                                                // password manager.
                                                autoComplete="off"
                                                spellCheck={false}
                                                className="h-8 pr-8 font-mono text-xs"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowToken(v => !v)}
                                                aria-label={t(showToken ? "workspace.secrets.hide" : "workspace.secrets.show")}
                                                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
                                            >
                                                {showToken ? (
                                                    <EyeOffIcon className="size-3.5" aria-hidden />
                                                ) : (
                                                    <EyeIcon className="size-3.5" aria-hidden />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="github-direction" className="text-xs">
                                            {t("workspace.github.directionLabel")}
                                        </Label>
                                        <Select
                                            value={direction}
                                            onValueChange={next => setDirection(next as GithubSyncDirection)}
                                        >
                                            <SelectTrigger id="github-direction" size="sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SYNC_DIRECTIONS.map(option => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {t(option.labelKey)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-muted-foreground text-xs">
                                            {t("workspace.github.directionHint")}
                                        </p>
                                    </div>

                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={!token.trim() || !parsedRepo || connecting}
                                    >
                                        {connecting ? (
                                            <LoaderIcon className="size-4 animate-spin" aria-hidden />
                                        ) : (
                                            <CheckCircle2Icon className="size-4" aria-hidden />
                                        )}
                                        {t("workspace.github.connect")}
                                    </Button>
                                </form>
                            )
                        )}
                    </div>
                </PaidFeature>
            </Modal>

            {guard.confirmDialog}

            <ConfirmDialog
                open={disconnecting}
                onOpenChange={setDisconnecting}
                tone="danger"
                title={t("workspace.github.disconnectTitle")}
                description={t("workspace.github.disconnectDescription")}
                confirmLabel={t("workspace.github.disconnect")}
                onConfirm={handleDisconnect}
            />
        </>
    );
}
