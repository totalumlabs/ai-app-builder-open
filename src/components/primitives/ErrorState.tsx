"use client";

import * as React from "react";
import { AlertTriangleIcon, ArrowLeftIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  /** Already-translated title. Defaults to the shared "we couldn't load this". */
  title?: string;
  /** Already-translated description. */
  description?: string;
  /** Technical detail — only rendered in development. */
  detail?: string;
  /** When provided, a retry button is shown. */
  onRetry?: () => void;
  retrying?: boolean;
  /**
   * ⭐ A WAY OUT THAT IS NOT "TRY THE THING THAT JUST FAILED".
   *
   * ⚠️ RETRY IS NOT ALWAYS AN EXIT. On a full-page failure — a workspace that will
   * not load, a project list that will not fetch — retry is the only control on
   * screen, and when it keeps failing the user is stranded on a page with no
   * navigation (the workspace has no sidebar). One link home fixes that.
   *
   * ⚠️ BOTH PROPS OR NEITHER. A href with no label renders nothing; the pair is
   * what makes it opt-in, so every existing call site is byte-identical.
   */
  secondaryHref?: string;
  /** Already-translated label for `secondaryHref`. */
  secondaryLabel?: string;
  variant?: "page" | "panel" | "inline";
  className?: string;
}

/**
 * The one error state, with retry.
 *
 * HARD RULE for every phase: every async surface has a loading skeleton, an
 * empty state AND this. A failed fetch never leaves a blank region behind.
 */
export function ErrorState({
  title,
  description,
  detail,
  onRetry,
  retrying = false,
  secondaryHref,
  secondaryLabel,
  variant = "panel",
  className,
}: ErrorStateProps) {
  const t = useT();
  const isDev = process.env.NODE_ENV !== "production";

  if (variant === "inline") {
    return (
      <div
        role="alert"
        className={cn(
          "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm",
          className,
        )}
      >
        <AlertTriangleIcon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">{title ?? t("common.loadFailed")}</span>
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
            {t("common.retry")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "page"
          ? "bg-card min-h-[22rem] rounded-2xl border px-6 py-14 shadow-2xs"
          : "px-6 py-10",
        className,
      )}
    >
      <span
        aria-hidden
        className="bg-destructive-subtle text-destructive-subtle-foreground mb-4 grid size-11 place-items-center rounded-xl"
      >
        <AlertTriangleIcon className="size-5" />
      </span>

      <h3 className="text-foreground font-display text-base font-semibold">
        {title ?? t("common.loadFailed")}
      </h3>
      <p className="text-muted-foreground mt-1.5 max-w-sm text-sm">
        {description ?? t("common.loadFailedDescription")}
      </p>

      {isDev && detail ? (
        <pre className="bg-surface-sunken text-muted-foreground tp-scroll mt-4 max-h-32 max-w-full overflow-auto rounded-lg border p-3 text-left text-xs">
          {detail}
        </pre>
      ) : null}

      {onRetry || (secondaryHref && secondaryLabel) ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <Button variant="outline" onClick={onRetry} disabled={retrying}>
              <RotateCcwIcon aria-hidden className={cn(retrying && "animate-spin-slow")} />
              {t("common.retry")}
            </Button>
          ) : null}
          {secondaryHref && secondaryLabel ? (
            /* ⚠️ A REAL LINK, NOT A ROUTER PUSH. When the page it sits on has failed
               to load, a client-side navigation is the thing least likely to be
               working; an anchor always is. */
            <Button asChild variant={onRetry ? "ghost" : "outline"}>
              <Link href={secondaryHref}>
                <ArrowLeftIcon aria-hidden />
                {secondaryLabel}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
