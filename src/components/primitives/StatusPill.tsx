import * as React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  brand: "bg-primary-subtle text-primary-subtle-foreground border-transparent",
  info: "bg-info-subtle text-info-subtle-foreground border-transparent",
  success: "bg-success-subtle text-success-subtle-foreground border-transparent",
  warning: "bg-warning-subtle text-warning-subtle-foreground border-transparent",
  danger: "bg-destructive-subtle text-destructive-subtle-foreground border-transparent",
  outline: "bg-transparent text-foreground border-border",
} as const;

const DOTS = {
  neutral: "bg-muted-foreground",
  brand: "bg-primary",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  outline: "bg-muted-foreground",
} as const;

export type StatusTone = keyof typeof TONES;

export interface StatusPillProps extends React.ComponentProps<"span"> {
  tone?: StatusTone;
  /** Show a leading dot. */
  dot?: boolean;
  /** Animate the dot — for genuinely in-flight states only (building, deploying). */
  pulse?: boolean;
  size?: "sm" | "md";
  icon?: React.ReactNode;
}

/**
 * Compact status label. Copy is always passed in already translated
 * (`t("status.building")`), so the same pill serves projects, deployments,
 * domains and invoices.
 */
export function StatusPill({
  tone = "neutral",
  dot = false,
  pulse = false,
  size = "sm",
  icon,
  className,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "text-2xs px-2 py-0.5" : "px-2.5 py-1 text-xs",
        "[&_svg]:size-3 [&_svg]:shrink-0",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span aria-hidden className="relative grid size-1.5 shrink-0 place-items-center">
          {pulse ? (
            <span
              className={cn("absolute size-1.5 animate-ping rounded-full opacity-70", DOTS[tone])}
            />
          ) : null}
          <span className={cn("size-1.5 rounded-full", DOTS[tone])} />
        </span>
      ) : null}
      {icon}
      {children}
    </span>
  );
}
