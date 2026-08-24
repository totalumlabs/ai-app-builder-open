import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeletons.
 *
 * HARD RULE for every phase: an async surface never renders a blank area and
 * never renders a bare spinner where the final shape is known. Use the skeleton
 * that matches the real layout so the page doesn't jump when data lands.
 */

export function SkeletonBox({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("bg-muted relative overflow-hidden rounded-md", className)}
      {...props}
    >
      <span className="tp-shimmer absolute inset-0" />
    </div>
  );
}

/** N lines of fake text. The last line is short, like real prose. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-2/5" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card rounded-xl border p-5 shadow-2xs", className)}>
      <div className="flex items-center gap-3">
        <SkeletonBox className="size-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <SkeletonBox className="h-3.5 w-2/5" />
          <SkeletonBox className="h-3 w-1/4" />
        </div>
      </div>
      <SkeletonText lines={2} className="mt-5" />
    </div>
  );
}

export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("divide-border bg-card divide-y rounded-xl border", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <SkeletonBox className="size-8 rounded-lg" />
          <SkeletonBox className="h-3.5 flex-1" />
          <SkeletonBox className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 6,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border", className)}>
      <div className="bg-surface-sunken flex gap-4 border-b px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBox key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-border bg-card divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, c) => (
              <SkeletonBox key={c} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matches <PageHeader> so a whole page can render a skeleton shell. */
export function SkeletonPageHeader() {
  return (
    <div className="space-y-3">
      <SkeletonBox className="h-7 w-52" />
      <SkeletonBox className="h-4 w-80 max-w-full" />
    </div>
  );
}
