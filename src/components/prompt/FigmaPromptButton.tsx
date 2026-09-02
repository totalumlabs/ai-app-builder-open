"use client";

import * as React from "react";
import { FigmaIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * ⭐ ADD A FIGMA DESIGN TO THE PROMPT — the Figma icon in the composer's tool tray.
 *
 * ── WHY IT PUTS A LINK IN THE BOX RATHER THAN OPENING THE CONNECT MODAL ─────
 *
 * The connect modal is about a CREDENTIAL and is per project; this is about the
 * thing people actually came to do, and the product already documents it —
 * `figma.enablesTip` says "copy a link to a frame in Figma and paste it into a
 * prompt". Until now nothing in the composer said so, so the feature was
 * discoverable only by reading a modal you had to already know existed.
 *
 * ── ⚠️⚠️ CONNECT FIRST. THE URL FIELD DOES NOT EXIST UNTIL FIGMA IS CONNECTED ──
 *
 * It used to offer the URL box to everyone, with "connect Figma" as an optional
 * footnote underneath. **That produced a prompt that could not work.** A Figma link
 * is not an image the agent can look at — it is a file key it has to FETCH from the
 * Figma API, with the user's own token. No token, no design: the agent gets a 403,
 * invents something from the URL slug, and the person is left wondering why the
 * result looks nothing like their mockup. Reported from the dashboard.
 *
 * So the popover has two states and the order is the point:
 *
 *   NOT CONNECTED → what connecting buys you, and one button that connects. No URL
 *                   field at all, because a link pasted here would be a dead end.
 *   CONNECTED     → the URL field, exactly as before.
 *
 * ⚠️ IT IS THE SAME COMPONENT ON BOTH SURFACES, and both now pass `onConnect`. On
 * the dashboard there is no project yet, so "connect" means *validate a token and
 * hold it for the project this prompt is about to create* — see `FigmaModal`'s
 * pending mode and `ProjectsDashboard`. The button does not need to know which; it
 * asks the surface to connect and reads `connected` back.
 *
 * ⚠️ IT NEVER SUBMITS. Like the transcript from the microphone, the link is
 * APPENDED and left editable — the user adds their own instructions around it.
 */

/**
 * Is this a Figma URL?
 *
 * ⚠️ HOST-ANCHORED, NOT `includes("figma.com")`. A substring test passes
 * `https://figma.com.evil.example/x`, and the value goes straight into a prompt
 * that an agent will fetch. Parsing and comparing the host is the only honest
 * check. `figma.com` and any subdomain (`www.`) are accepted.
 */
export function isFigmaUrl(value: string): boolean {
  const trimmed = (value || "").trim();
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return host === "figma.com" || host.endsWith(".figma.com");
  } catch {
    return false;
  }
}

export interface FigmaPromptButtonProps {
  /** Append this text to the prompt. The composer owns the caret. */
  onAdd: (text: string) => void;
  /** True when the composer already holds something — changes what we insert. */
  hasText: boolean;
  disabled?: boolean;
  /**
   * Open this surface's Figma connect flow.
   *
   * ⚠️ REQUIRED IN PRACTICE ON BOTH SURFACES NOW. Without it an unconnected user
   * sees an explanation and no way to act on it, which is the state this change
   * exists to remove. It stays optional only so a caller cannot be broken by the
   * signature; `connectUnavailable` below is what that case renders.
   */
  onConnect?: () => void;
  /**
   * Whether the design can actually be read: a connected project in the
   * workspace, or a validated token waiting for the project on the dashboard.
   *
   * ⚠️ IT GATES THE URL FIELD. `false` means the field is not rendered at all.
   */
  connected?: boolean;
  /**
   * ⭐ UNDO THE CONNECTION, from the same place it was made.
   *
   * ⚠️ THE SURFACE DOES THE WORK, NOT THIS COMPONENT — and the two surfaces mean
   * genuinely different things by it. In the workspace it is a `DELETE` against a
   * real project; on the dashboard it only drops a token being held in memory for
   * a project that does not exist yet. A widget that owned the API call would have
   * to know which, and would be wrong on one of them.
   *
   * ⚠️ IT MAY BE ASYNC AND IT MAY FAIL. The button awaits it and keeps the popover
   * open on a rejection, so a failed disconnect does not look like a successful
   * one. The surface still owns the error message.
   */
  onDisconnect?: () => void | Promise<void>;
  /**
   * The confirm sentence, when the default one would be wrong.
   *
   * ⚠️ THE SURFACE OWNS THIS COPY BECAUSE THE SURFACE OWNS THE MEANING. In the
   * workspace, disconnecting cuts a live link and "until you connect it again" is
   * exactly right. On the dashboard nothing has been connected yet — a token is
   * being held for a project that does not exist — so the same sentence would
   * describe an event that never happened.
   */
  disconnectConfirm?: string;
}

export function FigmaPromptButton({
  onAdd,
  hasText,
  disabled = false,
  onConnect,
  connected = false,
  onDisconnect,
  disconnectConfirm,
}: FigmaPromptButtonProps) {
  const t = useT();

  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  /**
   * ⚠️ A TWO-STEP CONFIRM, INLINE, NOT AN `AlertDialog`.
   *
   * Disconnecting is not catastrophic — you reconnect by pasting a token again —
   * but it is not nothing either: the agent stops being able to read the design,
   * and the person who finds out is the one whose next prompt builds the wrong
   * thing. So it asks. Inline, because a Radix alert dialog opened from inside a
   * Radix popover fights over focus and the dismiss, and because the question is
   * one line long.
   */
  const [confirmingDisconnect, setConfirmingDisconnect] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);

  async function disconnect() {
    if (!onDisconnect || disconnecting) return;
    setDisconnecting(true);
    try {
      await onDisconnect();
      // Only on success: a popover that closed on a failed disconnect would read
      // as "done" for something that did not happen.
      setConfirmingDisconnect(false);
      setOpen(false);
    } catch {
      // The surface reports it (a toast). Here we simply stay put, still
      // connected, with the confirm still showing so it can be retried.
    } finally {
      setDisconnecting(false);
    }
  }

  const valid = isFigmaUrl(url);
  const showError = touched && url.trim().length > 0 && !valid;

  function add() {
    if (!valid) {
      setTouched(true);
      return;
    }

    /**
     * ⚠️ A BARE URL IS A BAD PROMPT ON ITS OWN, and a lead-in written over the
     * user's own sentence is worse. So: an empty box gets the full instruction,
     * a box with something in it gets just the link, and the user's words are
     * never rewritten either way.
     */
    onAdd(
      hasText
        ? url.trim()
        : t("workspace.figma.promptTemplate", { url: url.trim() }),
    );

    setUrl("");
    setTouched(false);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setTouched(false);
          // Reopening must never land on a half-answered question.
          setConfirmingDisconnect(false);
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              /* `secondary` only when tinted — see the note in
                               `GithubPromptButton`: `ghost`'s `dark:hover:` rule
                               out-specifies a tint and would strip it on hover. */
              variant={connected ? "secondary" : "ghost"}
              size="icon"
              /*
                              ⚠️ CONNECTED IS A TINT, AND IT IS THE SAME TINT GITHUB
                              WEARS. The two integrations sit next to each other in the
                              row and answer the same question — "is this project
                              linked?" — so a person who has learnt one has learnt both.

                              ⚠️ THE HERO IS NEVER TINTED, and that is not a gap: with
                              no project there is nothing to be connected TO, so `false`
                              is the honest answer rather than a missing one.
                            */
              className={cn(
                "size-8 shrink-0",
                connected &&
                  "bg-success-subtle text-success-subtle-foreground hover:bg-success-subtle/70 ring-success/40 ring-1 ring-inset",
              )}
              disabled={disabled}
              aria-label={t("workspace.figma.addToPrompt")}
            >
              <FigmaIcon className="size-4" aria-hidden />
              {connected ? (
                <span className="sr-only">
                  {t("workspace.figma.statusConnected")}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("workspace.figma.addToPrompt")}</TooltipContent>
      </Tooltip>

      <PopoverContent align="start" className="w-80 space-y-3">
        {/*
                  ── NOT CONNECTED: connect, and nothing else ────────────────
                  ⚠️ NO URL FIELD IN THIS BRANCH. See the header: a link without a
                  token is a prompt that silently cannot work, and offering the box
                  is what made people write one.
                */}
        {!connected ? (
          <>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {t("workspace.figma.gateTitle")}
              </p>
              <p className="text-muted-foreground text-xs">
                {t("workspace.figma.gateBody")}
              </p>
            </div>

            {onConnect ? (
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  onConnect();
                }}
              >
                {t("workspace.figma.connect")}
              </Button>
            ) : (
              /* No flow was wired for this surface. Say so plainly
                               rather than showing a button that does nothing. */
              <p className="text-muted-foreground text-xs">
                {t("workspace.figma.connectUnavailable")}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="space-y-1">
              <Label htmlFor="figma-prompt-url" className="text-sm font-medium">
                {t("workspace.figma.linkLabel")}
              </Label>
              <p className="text-muted-foreground text-xs">
                {t("workspace.figma.linkHint")}
              </p>
            </div>

            <Input
              id="figma-prompt-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onBlur={() => setTouched(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
              placeholder="https://www.figma.com/design/…"
              spellCheck={false}
              autoComplete="off"
              aria-invalid={showError}
            />

            {showError ? (
              <p className="text-destructive text-xs">
                {t("workspace.figma.linkInvalid")}
              </p>
            ) : null}

            <Button
              type="button"
              className="w-full"
              disabled={!valid}
              onClick={add}
            >
              {t("workspace.figma.addAction")}
            </Button>

            {/*
              ⭐ DISCONNECT, FROM WHERE THE CONNECTION IS VISIBLE.
              The Figma button wears a green tint once connected, so this popover is
              where someone goes to ask "what is this connected to, and can I undo
              it?" — the answer used to be somewhere else entirely (the workspace
              menu, and nowhere at all on the dashboard).

              ⚠️ QUIET, AND BELOW A HAIRLINE. The job of this popover is adding a
              link; disconnecting is the rare, destructive-adjacent neighbour and
              must not compete with the primary button above it.
            */}
            {onDisconnect ? (
              <div className="border-t pt-2.5">
                {confirmingDisconnect ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs">
                      {disconnectConfirm || t("workspace.figma.disconnectConfirm")}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={disconnecting}
                        onClick={() => setConfirmingDisconnect(false)}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        disabled={disconnecting}
                        onClick={() => void disconnect()}
                      >
                        {t(
                          disconnecting
                            ? "workspace.figma.disconnecting"
                            : "workspace.figma.disconnect",
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDisconnect(true)}
                    className="text-muted-foreground hover:text-destructive focus-visible:ring-ring w-full rounded text-left text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {t("workspace.figma.disconnect")}
                  </button>
                )}
              </div>
            ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
