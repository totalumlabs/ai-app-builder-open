"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon, KeyIcon, LoaderIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { ConfirmDialog, EmptyState, Modal, StatusPill, type StatusTone } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import { isValidSecretName, parseEnv } from "@/lib/env-parse";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import type { VcaasSecret } from "@/lib/vcaas-types";
import { cn } from "@/lib/utils";
import { useDirtyGuard } from "./use-dirty-guard";

/**
 * PROJECT SECRETS.
 *
 * ⚠️ SECRET VALUES ARE WRITE-ONLY. VCaaS never returns them — the list carries only
 * `{ _id, secretName, environment }`. That is correct, and the UI must not pretend
 * otherwise: there is no "reveal" affordance, because there is nothing to reveal.
 * A masked placeholder that could never be unmasked would be a lie about what the
 * product stores.
 *
 * ── THE `.env` BULK HELPER ──────────────────────────────────────────────────
 *
 * Typing a dozen secrets one at a time is where people abandon the setup. Pasting
 * a `.env` is the real workflow, so it is a first-class tab rather than a hidden
 * extra. Parsing lives in `@/lib/env-parse` and is unit-tested against the cases
 * that silently corrupt secrets (`=` inside values, `#` inside quoted passwords).
 */

type Environment = "development" | "production" | "both";

const ENVIRONMENTS: { value: Environment; labelKey: TranslationKey }[] = [
    { value: "both", labelKey: "workspace.secrets.envBoth" },
    { value: "development", labelKey: "workspace.secrets.envDevelopment" },
    { value: "production", labelKey: "workspace.secrets.envProduction" },
];

const ENV_TONE: Record<string, StatusTone> = {
    both: "brand",
    development: "info",
    production: "success",
};

export interface SecretsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    secrets: VcaasSecret[];
    /** Re-read the project so the list reflects the change. */
    onChanged: () => void;
}

export function SecretsModal({
    open,
    onOpenChange,
    projectId,
    secrets,
    onChanged,
}: SecretsModalProps) {
    const t = useT();

    const [mode, setMode] = React.useState<"single" | "bulk">("single");
    const [name, setName] = React.useState("");
    const [value, setValue] = React.useState("");
    const [environment, setEnvironment] = React.useState<Environment>("both");
    const [showValue, setShowValue] = React.useState(false);
    const [bulkText, setBulkText] = React.useState("");
    const [bulkEnvironment, setBulkEnvironment] = React.useState<Environment>("both");
    const [saving, setSaving] = React.useState(false);
    const [deleting, setDeleting] = React.useState<VcaasSecret | null>(null);

    // Dirty = a typed secret that would be LOST. A name alone is not worth a prompt.
    const isDirty = value.trim().length > 0 || bulkText.trim().length > 0;
    const guard = useDirtyGuard(isDirty, () => onOpenChange(false));

    function reset() {
        setName("");
        setValue("");
        setBulkText("");
        setShowValue(false);
    }

    React.useEffect(() => {
        if (!open) reset();
    }, [open]);

    const nameError = name.trim().length > 0 && !isValidSecretName(name.trim());
    const duplicate = secrets.some(secret => secret.secretName === name.trim());
    const canSubmitSingle = !!name.trim() && !!value.trim() && !nameError && !saving;

    const parsed = React.useMemo(() => parseEnv(bulkText), [bulkText]);

    async function handleCreateSingle(event: React.FormEvent) {
        event.preventDefault();
        if (!canSubmitSingle) return;

        setSaving(true);
        const response = await vcaasApi.secrets.create(projectId, {
            secretName: name.trim(),
            secretValue: value,
            environment,
        });
        setSaving(false);

        if (response.ok) {
            toast.success(t("workspace.secrets.created", { name: name.trim() }));
            reset();
            onChanged();
        } else {
            toast.error(t("workspace.secrets.createFailed"), { description: response.error || undefined });
        }
    }

    async function handleCreateBulk() {
        if (parsed.entries.length === 0 || saving) return;

        setSaving(true);

        // Sequential on purpose: the upstream rate-limits, and a partial failure
        // mid-way must leave a clear count rather than an unknowable mess.
        let created = 0;
        const failed: string[] = [];

        for (const entry of parsed.entries) {
            const response = await vcaasApi.secrets.create(projectId, {
                secretName: entry.name,
                secretValue: entry.value,
                environment: bulkEnvironment,
            });
            if (response.ok) created += 1;
            else failed.push(entry.name);
        }

        setSaving(false);

        if (created > 0) {
            toast.success(t("workspace.secrets.bulkCreated", { count: created }));
            setBulkText("");
            onChanged();
        }
        // Name what failed — "some secrets failed" is unactionable.
        if (failed.length > 0) {
            toast.error(t("workspace.secrets.bulkFailed", { names: failed.join(", ") }));
        }
    }

    async function handleDelete(secret: VcaasSecret) {
        const response = await vcaasApi.secrets.remove(projectId, secret._id);

        if (!response.ok) {
            toast.error(t("workspace.secrets.deleteFailed"), { description: response.error || undefined });
            throw new Error(response.error || "delete failed");
        }

        toast.success(t("workspace.secrets.deleted", { name: secret.secretName }));
        onChanged();
    }

    return (
        <>
            <Modal
                open={open}
                onOpenChange={guard.onOpenChange}
                /* ⚠️ DO NOT ADD `dismissible={!isDirty}` HERE. `dismissible={false}`
                   makes the Modal `preventDefault()` the ESC/overlay events, so Radix
                   never fires `onOpenChange` — and the dirty guard, which works BY
                   intercepting that call, never runs. The result is a modal that
                   silently ignores Escape with no explanation, which is worse than
                   either behaviour on its own. The guard is the whole mechanism. */
                size="lg"
                title={t("workspace.secrets.title")}
                description={t("workspace.secrets.description")}
            >
                <div className="space-y-4">
                    {/* ── Existing secrets ────────────────────────────────── */}
                    <section>
                        <h3 className="text-muted-foreground mb-2 text-xs font-medium">
                            {t("workspace.secrets.existing", { count: secrets.length })}
                        </h3>

                        {secrets.length === 0 ? (
                            <EmptyState
                                variant="panel"
                                icon={<KeyIcon />}
                                title={t("workspace.secrets.emptyTitle")}
                                description={t("workspace.secrets.emptyDescription")}
                            />
                        ) : (
                            <ul className="space-y-1.5">
                                {secrets.map(secret => (
                                    <li
                                        key={secret._id}
                                        className="border-border flex items-center gap-2 rounded-lg border p-2"
                                    >
                                        <code className="min-w-0 flex-1 truncate font-mono text-xs font-medium">
                                            {secret.secretName}
                                        </code>
                                        {/* No value, and no fake mask — VCaaS never returns it. */}
                                        <span className="text-muted-foreground/60 font-mono text-xs select-none">
                                            ••••••••
                                        </span>
                                        <StatusPill tone={ENV_TONE[secret.environment] ?? "neutral"}>
                                            {secret.environment}
                                        </StatusPill>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive size-7 shrink-0"
                                            onClick={() => setDeleting(secret)}
                                            aria-label={t("workspace.secrets.delete", { name: secret.secretName })}
                                        >
                                            <Trash2Icon className="size-3.5" aria-hidden />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* ── Add ─────────────────────────────────────────────── */}
                    <section className="border-border/60 border-t pt-4">
                        <div className="bg-muted mb-3 flex w-fit gap-0.5 rounded-lg p-0.5">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMode("single")}
                                aria-pressed={mode === "single"}
                                className={cn("h-7 px-2.5 text-xs", mode === "single" && "bg-card shadow-2xs")}
                            >
                                {t("workspace.secrets.addOne")}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMode("bulk")}
                                aria-pressed={mode === "bulk"}
                                className={cn("h-7 px-2.5 text-xs", mode === "bulk" && "bg-card shadow-2xs")}
                            >
                                {t("workspace.secrets.pasteEnv")}
                            </Button>
                        </div>

                        {mode === "single" ? (
                            <form onSubmit={handleCreateSingle} className="space-y-3">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="secret-name" className="text-xs">
                                            {t("workspace.secrets.nameLabel")}
                                        </Label>
                                        <Input
                                            id="secret-name"
                                            value={name}
                                            onChange={event => setName(event.target.value)}
                                            placeholder="STRIPE_SECRET_KEY"
                                            autoComplete="off"
                                            spellCheck={false}
                                            aria-invalid={nameError}
                                            className={cn("h-8 font-mono text-xs", nameError && "border-destructive")}
                                        />
                                        {nameError && (
                                            <p className="text-destructive text-xs">
                                                {t("workspace.secrets.nameInvalid")}
                                            </p>
                                        )}
                                        {!nameError && duplicate && (
                                            <p className="text-warning-subtle-foreground text-xs">
                                                {t("workspace.secrets.nameDuplicate")}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="secret-env" className="text-xs">
                                            {t("workspace.secrets.envLabel")}
                                        </Label>
                                        <Select
                                            value={environment}
                                            onValueChange={next => setEnvironment(next as Environment)}
                                        >
                                            <SelectTrigger id="secret-env" size="sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ENVIRONMENTS.map(option => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {t(option.labelKey)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="secret-value" className="text-xs">
                                        {t("workspace.secrets.valueLabel")}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="secret-value"
                                            // Masked by default so a shoulder-surfer or a screen share
                                            // does not capture it while it is being pasted.
                                            type={showValue ? "text" : "password"}
                                            value={value}
                                            onChange={event => setValue(event.target.value)}
                                            autoComplete="off"
                                            spellCheck={false}
                                            className="h-8 pr-8 font-mono text-xs"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowValue(v => !v)}
                                            aria-label={t(showValue ? "workspace.secrets.hide" : "workspace.secrets.show")}
                                            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
                                        >
                                            {showValue ? (
                                                <EyeOffIcon className="size-3.5" aria-hidden />
                                            ) : (
                                                <EyeIcon className="size-3.5" aria-hidden />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <Button type="submit" size="sm" disabled={!canSubmitSingle}>
                                    {saving ? (
                                        <LoaderIcon className="size-4 animate-spin" aria-hidden />
                                    ) : (
                                        <PlusIcon className="size-4" aria-hidden />
                                    )}
                                    {t("workspace.secrets.add")}
                                </Button>
                            </form>
                        ) : (
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="secret-bulk" className="text-xs">
                                        {t("workspace.secrets.bulkLabel")}
                                    </Label>
                                    <Textarea
                                        id="secret-bulk"
                                        value={bulkText}
                                        onChange={event => setBulkText(event.target.value)}
                                        rows={6}
                                        spellCheck={false}
                                        placeholder={"STRIPE_SECRET_KEY=sk_live_...\nDATABASE_URL=postgres://..."}
                                        className="font-mono text-xs"
                                    />
                                    {/* Show exactly what WILL be created before it is — a bulk
                                        import that silently drops lines is worse than none. */}
                                    <p className="text-muted-foreground text-xs">
                                        {bulkText.trim()
                                            ? t("workspace.secrets.bulkPreview", {
                                                  count: parsed.entries.length,
                                                  skipped: parsed.skipped,
                                              })
                                            : t("workspace.secrets.bulkHint")}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-end gap-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="bulk-env" className="text-xs">
                                            {t("workspace.secrets.envLabel")}
                                        </Label>
                                        <Select
                                            value={bulkEnvironment}
                                            onValueChange={next => setBulkEnvironment(next as Environment)}
                                        >
                                            {/* ⚠️ NOT `w-40`: "Development + Production" is
                                                ~165px of text and a 160px trigger clipped it
                                                to "Developmen…". The base trigger is `w-fit`,
                                                so leaving the width alone shows the whole
                                                label — same as the single-secret picker above. */}
                                            <SelectTrigger id="bulk-env" size="sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ENVIRONMENTS.map(option => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {t(option.labelKey)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button
                                        size="sm"
                                        onClick={handleCreateBulk}
                                        disabled={parsed.entries.length === 0 || saving}
                                    >
                                        {saving ? (
                                            <LoaderIcon className="size-4 animate-spin" aria-hidden />
                                        ) : (
                                            <PlusIcon className="size-4" aria-hidden />
                                        )}
                                        {t("workspace.secrets.addAll", { count: parsed.entries.length })}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </Modal>

            {guard.confirmDialog}

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={openState => {
                    if (!openState) setDeleting(null);
                }}
                tone="danger"
                title={t("workspace.secrets.deleteTitle", { name: deleting?.secretName ?? "" })}
                description={t("workspace.secrets.deleteDescription")}
                confirmLabel={t("common.delete")}
                onConfirm={async () => {
                    if (deleting) await handleDelete(deleting);
                }}
            />
        </>
    );
}
