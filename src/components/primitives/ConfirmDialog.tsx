"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { useT } from "@/i18n/locale-provider";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already-translated title, phrased as a question. */
  title: React.ReactNode;
  /** Already-translated description — say exactly what will happen. */
  description?: React.ReactNode;
  /** Already-translated confirm label. Defaults to `common.confirm`. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for anything destructive or irreversible. */
  tone?: "default" | "danger";
  /**
   * When set, the user must type this exact string to enable the confirm
   * button. Use it for deletes (project names, "DELETE", …).
   */
  confirmPhrase?: string;
  /** Extra content between the description and the input (cost notices…). */
  children?: React.ReactNode;
  /** May be async; the dialog shows a pending state and closes on success. */
  onConfirm: () => void | Promise<void>;
}

/**
 * The one confirmation dialog.
 *
 * Never use `window.confirm`. Destructive actions use `tone="danger"` plus a
 * `confirmPhrase` so they cannot be triggered by a mis-click.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
  confirmPhrase,
  children,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useT();
  const [typed, setTyped] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const inputId = React.useId();

  // Reset the typed guard every time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setTyped("");
      setPending(false);
    }
  }, [open]);

  const phraseSatisfied = !confirmPhrase || typed.trim() === confirmPhrase;

  const handleConfirm = async () => {
    if (!phraseSatisfied || pending) return;
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
      title={title}
      description={description}
      size="sm"
      dismissible={!pending}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!phraseSatisfied || pending}
          >
            {pending ? <Spinner size="xs" /> : null}
            {confirmLabel ?? t("common.confirm")}
          </Button>
        </>
      }
    >
      {children}

      {confirmPhrase ? (
        <div className="mt-1 space-y-2">
          <Label htmlFor={inputId} className="text-xs font-medium">
            {t("common.typeToConfirm", { value: confirmPhrase })}
          </Label>
          <Input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="font-mono"
            disabled={pending}
          />
        </div>
      ) : null}
    </Modal>
  );
}
