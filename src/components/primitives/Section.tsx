import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionProps extends Omit<React.ComponentProps<"section">, "title"> {
  /** Already-translated section title. */
  title?: React.ReactNode;
  /** Already-translated supporting line. */
  description?: React.ReactNode;
  /** Right-aligned controls for this block. */
  actions?: React.ReactNode;
  /** Wrap the body in a bordered card surface. Default: true. */
  bordered?: boolean;
  /** Remove the body padding (for tables and lists that own their own edges). */
  flush?: boolean;
  contentClassName?: string;
}

/**
 * A titled block inside a page. Two flavours:
 *   · bordered (default) — a card surface, for grouped controls and data
 *   · bordered={false}   — a plain titled region, for stacks of cards
 */
export function Section({
  title,
  description,
  actions,
  bordered = true,
  flush = false,
  className,
  contentClassName,
  children,
  ...props
}: SectionProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <section className={cn("space-y-4", className)} {...props}>
      {hasHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            {title ? (
              <h2 className="text-foreground font-display text-base font-semibold">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-muted-foreground max-w-prose text-sm">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          bordered && "bg-card rounded-xl border shadow-2xs",
          bordered && !flush && "p-5 sm:p-6",
          contentClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
