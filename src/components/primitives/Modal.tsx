"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

/**
 * The one modal in this product.
 *
 * Built on the shadcn Dialog (Radix) so focus trapping, focus restore, ESC,
 * scroll locking and `aria-modal` come for free. What we add:
 *   · centred dialog on >= sm, BOTTOM SHEET on mobile (thumb-reachable, with a
 *     grab handle) — CONTEXT §7.11 requires the mobile bottom-sheet behaviour
 *   · a scrollable body with sticky header/footer so long content never pushes
 *     the primary action off screen
 *   · one place to make every modal in phases 10–19 look identical
 *
 * Radix requires a Title for accessibility; when `title` is omitted pass
 * `srTitle` instead — never render a modal with no accessible name.
 */

const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-6xl",
} as const;

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already-translated title. */
  title?: React.ReactNode;
  /** Screen-reader-only name, when the visual design has no title. */
  srTitle?: string;
  /** Already-translated supporting line under the title. */
  description?: React.ReactNode;
  /** Content next to the title (a status pill, a link…). */
  headerAside?: React.ReactNode;
  /** Footer actions — primary LAST on desktop, first (top) on mobile. */
  footer?: React.ReactNode;
  size?: keyof typeof SIZES;
  /** false ⇒ overlay click and ESC do not close (use for dirty forms). */
  dismissible?: boolean;
  showCloseButton?: boolean;
  /** Remove body padding for panels that own their own edges (tables, editors). */
  flush?: boolean;
  className?: string;
  /**
   * Extra classes on the scrolling body.
   *
   * ⚠️ A HEIGHT HERE NEEDS `flex-none` WITH IT. The body is `flex-1` (`flex: 1 1 0%`),
   * so a `h-…` class on its own is only a hint: the flex layout still sizes the body
   * from the space available, and a child asking for `h-full` gets a percentage of a
   * height that was never settled — it falls back to its own content and overflows.
   * That is how the support chat's header and composer ended up outside the dialog.
   */
  bodyClassName?: string;
  children?: React.ReactNode;
}

export function Modal({
  open,
  onOpenChange,
  title,
  srTitle,
  description,
  headerAside,
  footer,
  size = "md",
  dismissible = true,
  showCloseButton = true,
  flush = false,
  className,
  bodyClassName,
  children,
}: ModalProps) {
  const t = useT();
  const descriptionId = React.useId();
  const hasHeader = Boolean(title || description || headerAside);

  const blockClose = (event: Event) => {
    if (!dismissible) event.preventDefault();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-ink-950/45 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          data-slot="modal-content"
          aria-describedby={description ? descriptionId : undefined}
          onPointerDownOutside={blockClose}
          onInteractOutside={blockClose}
          onEscapeKeyDown={(event) => {
            if (!dismissible) event.preventDefault();
          }}
          className={cn(
            "bg-card text-card-foreground fixed z-50 flex flex-col border shadow-xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            // Mobile: bottom sheet
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-b-0",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            // Desktop: centred dialog
            "sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:max-h-[85dvh] sm:w-[calc(100%-3rem)]",
            "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border-b",
            "sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
            "sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0",
            "duration-200 ease-out-quart",
            SIZES[size],
            className,
          )}
        >
          {/* Grab handle — mobile only, purely affordance */}
          <span
            aria-hidden
            className="bg-border mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full sm:hidden"
          />

          {srTitle && !title ? (
            <DialogTitle className="sr-only">{srTitle}</DialogTitle>
          ) : null}

          {hasHeader ? (
            <div className="flex shrink-0 items-start gap-3 px-5 pt-4 pb-4 sm:px-6 sm:pt-6">
              <div className="min-w-0 flex-1 space-y-1.5">
                {title ? (
                  <DialogTitle className="font-display text-base font-semibold sm:text-lg">
                    {title}
                  </DialogTitle>
                ) : null}
                {description ? (
                  <DialogDescription id={descriptionId} className="text-sm">
                    {description}
                  </DialogDescription>
                ) : null}
              </div>
              {headerAside ? <div className="shrink-0">{headerAside}</div> : null}
              {showCloseButton ? (
                <DialogPrimitive.Close
                  className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/60 -mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  aria-label={t("common.close")}
                >
                  <XIcon className="size-4" />
                </DialogPrimitive.Close>
              ) : null}
            </div>
          ) : null}

          <div
            className={cn(
              "tp-scroll min-h-0 flex-1 overflow-y-auto",
              !flush && "px-5 pb-5 sm:px-6",
              !hasHeader && !flush && "pt-5 sm:pt-6",
              bodyClassName,
            )}
          >
            {children}
          </div>

          {footer ? (
            <div className="bg-card/95 flex shrink-0 flex-col-reverse gap-2 border-t px-5 py-4 backdrop-blur-sm sm:flex-row sm:justify-end sm:px-6 [&>*]:w-full sm:[&>*]:w-auto">
              {footer}
            </div>
          ) : null}

          {/* Safe-area breathing room on iOS when there is no footer */}
          {!footer ? <div aria-hidden className="h-[env(safe-area-inset-bottom)] sm:hidden" /> : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

export { DialogPrimitive as ModalPrimitive };
