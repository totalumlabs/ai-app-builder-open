import * as React from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "size-3 border",
  sm: "size-4 border-[1.5px]",
  md: "size-5 border-2",
  lg: "size-7 border-2",
  xl: "size-10 border-[3px]",
} as const;

export interface SpinnerProps extends React.ComponentProps<"span"> {
  size?: keyof typeof SIZES;
  /** Accessible label. Pass an already-translated string. */
  label?: string;
}

/**
 * A CSS-only spinner: one element, no SVG, no layout shift.
 * The gap in the ring reads as motion even at 12px.
 */
export function Spinner({ size = "md", label, className, ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      aria-live="polite"
      className={cn("inline-block shrink-0", className)}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "block animate-spin-slow rounded-full border-current/25 border-t-current",
          SIZES[size],
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

/** Centred spinner for a whole panel while its first payload loads. */
export function SpinnerBlock({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex min-h-40 w-full flex-col items-center justify-center gap-3",
        className,
      )}
    >
      <Spinner size="lg" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}
