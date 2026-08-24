import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Lucide icon (or any node) rendered in the badge. */
  icon?: React.ReactNode;
  /** Already-translated title. */
  title: React.ReactNode;
  /** Already-translated description — say what to do next, not just "nothing here". */
  description?: React.ReactNode;
  /** Primary action first, then secondary. */
  actions?: React.ReactNode;
  /** Extra content below the actions (starter suggestions, tips…). */
  children?: React.ReactNode;
  /** `page` fills a route, `panel` sits inside a card or tab. */
  variant?: "page" | "panel";
  className?: string;
}

/**
 * The one empty state.
 *
 * An empty state is a conversion surface, not an apology: it always names the
 * next action. Later phases pass real CTAs into `actions`.
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  children,
  variant = "panel",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden text-center",
        variant === "page"
          ? "bg-card min-h-[26rem] rounded-2xl border px-6 py-16 shadow-2xs"
          : "px-6 py-12",
        className,
      )}
    >
      {variant === "page" ? (
        <span aria-hidden className="tp-grid pointer-events-none absolute inset-0 opacity-60" />
      ) : null}

      <div className="relative flex max-w-md flex-col items-center">
        {icon ? (
          <span
            aria-hidden
            className="bg-primary-subtle text-primary-subtle-foreground mb-5 grid size-12 place-items-center rounded-xl [&_svg]:size-5"
          >
            {icon}
          </span>
        ) : null}

        <h3 className="text-foreground font-display text-lg font-semibold">{title}</h3>

        {description ? (
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p>
        ) : null}

        {actions ? (
          <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {actions}
          </div>
        ) : null}

        {children ? <div className="mt-8 w-full">{children}</div> : null}
      </div>
    </div>
  );
}
