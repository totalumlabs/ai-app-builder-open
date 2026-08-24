"use client";

import * as React from "react";
import { ExternalLinkIcon, GlobeIcon, PartyPopperIcon } from "lucide-react";
import { CopyButton, Modal, StatusPill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

/**
 * ═══ "YOUR PROJECT IS LIVE" ═════════════════════════════════════════════════
 *
 * The one moment in the workspace that deserves a dialog rather than a toast: the
 * project has just become something the world can open, and the ADDRESS is the thing
 * the user now needs — to click, to copy, to send to somebody.
 *
 * ⚠️ IT IS ONLY EVER SHOWN FOR A PUBLISH WE WATCHED FINISH. Not on load, not from a
 * stored flag: the deploy watcher opens it on the transition to `success`. A modal
 * that appeared because a `deployment.status` field happened to read `success` would
 * greet every reload of a published project with a celebration of something that
 * happened last week — and would interrupt whatever the user actually came to do.
 *
 * ⚠️ AND ONLY FOR A PUBLISH. The other three operations (rebuild, pull, restart) put
 * the project back the way it was; there is nothing to announce and nothing to share,
 * so they settle with a toast. See `OperationBanner` for the part they do share.
 *
 * ── WHY THE URL IS THE CONTENT AND NOT A LINE OF PROSE ──────────────────────
 *
 * ⚠️ IT WRAPS, IT DOES NOT TRUNCATE. A custom domain clipped mid-word is the one
 * thing an address must never be — this is a value to be read and checked, and a
 * `…` in the middle of it makes the dialog useless for the only job it has.
 */
export function PublishedModal({
    open,
    onOpenChange,
    host,
    /** Opens the custom-domain dialog. Absent ⇒ the row is not offered. */
    onOpenDomain,
    /** `true` when a custom domain is already serving this project. */
    hasCustomDomain = false,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Hostname without a scheme, e.g. `my-app.totalum-project.com`. */
    host: string;
    onOpenDomain?: () => void;
    hasCustomDomain?: boolean;
}) {
    const t = useT();
    const url = `https://${host}`;

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            size="md"
            title={t("workspace.published.title")}
            description={t("workspace.published.description")}
            headerAside={
                <StatusPill tone="success" dot>
                    {t("workspace.deploy.live")}
                </StatusPill>
            }
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t("common.close")}
                    </Button>
                    {/*
                      ⚠️ THE PRIMARY ACTION IS OPENING IT, and it is a real anchor with
                      `target="_blank"` rather than a handler. A `window.open` from a
                      click inside a dialog is the shape pop-up blockers refuse, and
                      being refused HERE — at the one moment the product has something
                      to show off — is the worst possible place for it.
                    */}
                    <Button asChild className="gap-2">
                        <a href={url} target="_blank" rel="noopener noreferrer">
                            <ExternalLinkIcon className="size-4" aria-hidden />
                            {t("workspace.published.open")}
                        </a>
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <section className="border-success/30 bg-success-subtle/50 rounded-xl border p-4">
                    <p className="text-success-subtle-foreground flex items-center gap-1.5 text-2xs font-medium tracking-wider uppercase">
                        <PartyPopperIcon className="size-3.5" aria-hidden />
                        {t("workspace.published.urlLabel")}
                    </p>

                    <div className="mt-2 flex items-start gap-2">
                        <p className="min-w-0 flex-1 font-mono text-sm break-all">{host}</p>
                        <CopyButton value={url} size="icon" className="shrink-0" />
                    </div>
                </section>

                <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
                    {t("workspace.published.note")}
                </p>

                {/*
                  ⚠️ THE DOMAIN OFFER IS SUPPRESSED ONCE THERE IS ONE. Suggesting a
                  custom domain to somebody whose custom domain is the address they are
                  looking at is the product not reading its own screen.
                */}
                {onOpenDomain && !hasCustomDomain ? (
                    <button
                        type="button"
                        onClick={() => {
                            onOpenChange(false);
                            onOpenDomain();
                        }}
                        className="group hover:border-border-strong hover:bg-accent/40 focus-visible:ring-ring flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                        <span
                            aria-hidden
                            className="bg-primary-subtle text-primary grid size-9 shrink-0 place-items-center rounded-lg"
                        >
                            <GlobeIcon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">
                                {t("workspace.deploy.customDomain")}
                            </span>
                            <span className="text-muted-foreground block text-xs">
                                {t("workspace.deploy.customDomainHint")}
                            </span>
                        </span>
                    </button>
                ) : null}
            </div>
        </Modal>
    );
}
