"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export interface CopyButtonProps {
  /** The text to copy. May be a resolver for values fetched on demand
   *  (e.g. reveal-then-copy for API keys in Phase 17). */
  value: string | (() => string | Promise<string>);
  /** Already-translated label. When omitted the button is icon-only. */
  label?: string;
  /** Toast on success. Off by default — the inline check is usually enough. */
  withToast?: boolean;
  size?: "sm" | "default" | "icon";
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
  disabled?: boolean;
  onCopied?: () => void;
}

/**
 * Copy-to-clipboard with an inline confirmation.
 *
 * Falls back to a hidden textarea + `execCommand` for non-secure contexts and
 * older mobile browsers, because `navigator.clipboard` is undefined there and a
 * silent no-op would be the worst outcome on a page whose whole job is handing
 * the user a key or a DNS record.
 */
export function CopyButton({
  value,
  label,
  withToast = false,
  size = "icon",
  variant = "ghost",
  className,
  disabled,
  onCopied,
}: CopyButtonProps) {
  const t = useT();
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = async () => {
    let text: string;
    try {
      text = typeof value === "function" ? await value() : value;
    } catch {
      toast.error(t("common.copyFailed"));
      return;
    }

    const ok = await writeToClipboard(text);
    if (!ok) {
      toast.error(t("common.copyFailed"));
      return;
    }

    setCopied(true);
    onCopied?.();
    if (withToast) toast.success(t("common.copied"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleCopy}
      disabled={disabled}
      aria-label={label ? undefined : t("common.copyToClipboard")}
      title={label ? undefined : t("common.copyToClipboard")}
      className={cn("relative", className)}
    >
      {copied ? (
        <CheckIcon aria-hidden className="text-success" />
      ) : (
        <CopyIcon aria-hidden />
      )}
      {label ? <span>{copied ? t("common.copied") : label}</span> : null}
      <span aria-live="polite" className="sr-only">
        {copied ? t("common.copied") : ""}
      </span>
    </Button>
  );
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
