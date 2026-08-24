import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  /** Already-translated title. */
  title: React.ReactNode;
  /** Already-translated one-line description. */
  description?: React.ReactNode;
  /** Small label above the title (breadcrumb, section, plan…). */
  eyebrow?: React.ReactNode;
  /** Primary + secondary actions, right-aligned on desktop, stacked on mobile. */
  actions?: React.ReactNode;
  /** Tabs or filters that belong to the header block. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The single page-title treatment for the whole product.
 *
 * Every page in the app shell starts with one of these — consistent vertical
 * rhythm is most of what makes a product feel designed rather than assembled.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-5", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? (
            <p className="text-muted-foreground text-2xs font-medium tracking-widest uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-foreground font-display truncate text-2xl font-semibold">{title}</h1>
          {description ? (
            <p className="text-muted-foreground max-w-prose text-sm">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
