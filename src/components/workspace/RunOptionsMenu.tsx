"use client";

import * as React from "react";
import { EraserIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/i18n";
import { usePrice } from "@/components/credits/CreditsProvider";
import { cn } from "@/lib/utils";
import type { AgentEffort, AgentModel, AgentModelTier, AgentRunOptions } from "@/lib/vcaas-types";
import { EFFORTS, normalizeRunOptions, selectedTier, V2_FAST_MODE_AVAILABLE, visibleTiers } from "@/lib/run-options";

/**
 * Model / effort / fast-mode picker for the chat composer's tool tray (legacy). On a v2 project it
 * is ONE choice, Cheap / Normal / Expensive: the tier decides the model, effort and speed
 * (A10.10, 2026-09-30), so there is no effort or fast-mode control there.
 *
 * Sits in the same `size-8` icon-button footprint as the other tray tools and lights up
 * (ring + primary colour) whenever a non-default option is active, so a Sonnet or fast-mode
 * prompt is never sent by surprise. The choice is remembered per project — see `useRunOptions`.
 *
 * Product rules mirrored from the API (`POST /agent/start`):
 *  · model defaults to Opus; Sonnet is the explicit faster/cheaper choice.
 *  · effort is sent only when the user picked one (the default otherwise).
 *  · fast mode is Opus-only — the option is disabled (and cleared) while Sonnet is selected.
 *  · the menu says so up front: Totalum already routes each prompt to the best model and effort,
 *    so these are for people who know what they are doing.
 */

const DEFAULT_EFFORT = "default";

export interface RunOptionsMenuProps {
    value: AgentRunOptions;
    onChange: (next: AgentRunOptions) => void;
    disabled?: boolean;
    /**
     * ⭐ "Clear agent context" — forget the agent's Claude Code session so the NEXT prompt starts
     * fresh. Rendered only when the surface can do it (the workspace composer); the hero has no
     * project yet. `clearContextDisabled` greys it out while a run is in progress.
     */
    onClearContext?: () => void | Promise<void>;
    clearContextDisabled?: boolean;
    /** A v2 project (A5.7): the model picker becomes the cheap / normal / expensive tier picker. */
    v2?: boolean;
    /** G44 (A9.9): the hidden "Create on the new Totalum (beta)" switch — only when the browser carries `?beta=v2`. */
    betaV2?: { checked: boolean; onChange: (checked: boolean) => void };
}

export function RunOptionsMenu({ value, onChange, disabled, onClearContext, clearContextDisabled, v2 = false, betaV2 }: RunOptionsMenuProps) {
    const t = useT();
    const price = usePrice();
    // This app does not know the account's plan; a budget-only account is refused by the API, not hidden here.
    const cheapOnly = false;
    const model: AgentModel = value.model === "sonnet" ? "sonnet" : "opus";
    const tier: AgentModelTier = selectedTier(value, cheapOnly);
    const isDefault = v2 ? cheapOnly || tier === "auto" : model === "opus" && !value.effort && !value.fastMode;
    const fastModeAllowed = model === "opus";

    const setModel = (next: string) => {
        const nextModel: AgentModel = next === "sonnet" ? "sonnet" : "opus";
        onChange(normalizeRunOptions({ ...value, model: nextModel }));
    };
    const setTier = (next: string) => {
        onChange(normalizeRunOptions({ ...value, model: undefined, modelTier: next as AgentModelTier }));
    };
    const setEffort = (next: string) => {
        onChange(normalizeRunOptions({ ...value, effort: next === DEFAULT_EFFORT ? undefined : (next as AgentEffort) }));
    };
    const setFastMode = (checked: boolean) => {
        onChange(normalizeRunOptions({ ...value, fastMode: checked }));
    };

    const summary = v2
        ? t(`engineV2.runTier.${tier}`)
        : [
              t(model === "sonnet" ? "workspace.chat.runOptions.modelSonnet" : "workspace.chat.runOptions.modelOpus"),
              value.effort ? t(`workspace.chat.runOptions.effort_${value.effort}`) : null,
              value.fastMode ? t("workspace.chat.runOptions.fastMode") : null,
          ]
              .filter(Boolean)
              .join(" · ");

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant={isDefault ? "ghost" : "secondary"}
                            size="icon"
                            className={cn("size-8 shrink-0", !isDefault && "ring-primary/40 text-primary ring-1")}
                            disabled={disabled}
                            aria-label={t("workspace.chat.runOptions.button")}
                        >
                            <SlidersHorizontalIcon className="size-4" aria-hidden />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                    {t("workspace.chat.runOptions.button")}: {summary}
                </TooltipContent>
            </Tooltip>

            <DropdownMenuContent align="start" className="w-72">
                <p className="text-muted-foreground px-2 pt-1.5 pb-1 text-xs leading-snug">
                    {t(v2 ? "engineV2.runTier.note" : "workspace.chat.runOptions.autoNote")}
                </p>
                <DropdownMenuSeparator />
                {betaV2 ? (
                    <>
                        <DropdownMenuCheckboxItem
                            checked={betaV2.checked}
                            onCheckedChange={checked => betaV2.onChange(checked === true)}
                            className="flex-col items-start gap-0.5"
                        >
                            <span>{t("engineV2.create.toggle")}</span>
                            <span className="text-muted-foreground text-xs">{t("engineV2.create.toggleHint", {
                                total: price(["MONTHLY_PROJECT_FEE", "MONTHLY_HOSTING_FEE"], "v2"),
                                project: price("MONTHLY_PROJECT_FEE", "v2"),
                                hosting: price("MONTHLY_HOSTING_FEE", "v2"),
                            })}</span>
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                    </>
                ) : null}
                <DropdownMenuLabel>{t(v2 ? "engineV2.runTier.label" : "workspace.chat.runOptions.model")}</DropdownMenuLabel>
                {v2 ? (
                    <>
                    <DropdownMenuRadioGroup value={tier} onValueChange={setTier}>
                        {visibleTiers(cheapOnly).map(option => (
                            <DropdownMenuRadioItem key={option} value={option} className="flex-col items-start gap-0.5">
                                <span>{t(`engineV2.runTier.${option}`)}</span>
                                <span className="text-muted-foreground text-xs">{t(`engineV2.runTier.${option}Hint`)}</span>
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                    {/* decide2: fast mode is the expensive tier's opt-in, off by default; hidden while the engine cannot serve it (f5fast) */}
                    {V2_FAST_MODE_AVAILABLE && tier === "expensive" ? (
                        <DropdownMenuCheckboxItem
                            checked={!!value.fastMode}
                            onCheckedChange={checked => setFastMode(checked === true)}
                            className="flex-col items-start gap-0.5"
                        >
                            <span>{t("workspace.chat.runOptions.fastMode")}</span>
                            <span className="text-muted-foreground text-xs">{t("workspace.chat.runOptions.fastModeHint")}</span>
                        </DropdownMenuCheckboxItem>
                    ) : null}
                    </>
                ) : (
                <DropdownMenuRadioGroup value={model} onValueChange={setModel}>
                    <DropdownMenuRadioItem value="opus" className="flex-col items-start gap-0.5">
                        <span>{t("workspace.chat.runOptions.modelOpus")}</span>
                        <span className="text-muted-foreground text-xs">{t("workspace.chat.runOptions.modelOpusHint")}</span>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="sonnet" className="flex-col items-start gap-0.5">
                        <span>{t("workspace.chat.runOptions.modelSonnet")}</span>
                        <span className="text-muted-foreground text-xs">{t("workspace.chat.runOptions.modelSonnetHint")}</span>
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                )}

                {v2 ? null : (
                <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span>{t("workspace.chat.runOptions.effort")}</span>
                    <span className="text-muted-foreground text-xs font-normal">{t("workspace.chat.runOptions.effortHint")}</span>
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup value={value.effort ?? DEFAULT_EFFORT} onValueChange={setEffort}>
                    <DropdownMenuRadioItem value={DEFAULT_EFFORT}>
                        {t("workspace.chat.runOptions.effortDefault")}
                    </DropdownMenuRadioItem>
                    {EFFORTS.map(level => (
                        <DropdownMenuRadioItem key={level} value={level}>
                            {t(`workspace.chat.runOptions.effort_${level}`)}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                    checked={fastModeAllowed && !!value.fastMode}
                    disabled={!fastModeAllowed}
                    onCheckedChange={checked => setFastMode(checked === true)}
                    className="flex-col items-start gap-0.5"
                >
                    <span>{t("workspace.chat.runOptions.fastMode")}</span>
                    <span className="text-muted-foreground text-xs">
                        {t(fastModeAllowed ? "workspace.chat.runOptions.fastModeHint" : "workspace.chat.runOptions.fastModeOpusOnly")}
                    </span>
                </DropdownMenuCheckboxItem>
                </>
                )}

                {onClearContext ? (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            disabled={clearContextDisabled}
                            onSelect={() => void onClearContext()}
                            className="flex-col items-start gap-0.5"
                        >
                            <span className="inline-flex items-center gap-1.5">
                                <EraserIcon className="size-3.5" aria-hidden />
                                {t("workspace.chat.runOptions.clearContext")}
                            </span>
                            <span className="text-muted-foreground text-xs">
                                {t(
                                    clearContextDisabled
                                        ? "workspace.chat.runOptions.clearContextWhileRunning"
                                        : v2
                                          ? "workspace.chat.runOptions.clearContextHintV2"
                                          : "workspace.chat.runOptions.clearContextHint",
                                )}
                            </span>
                        </DropdownMenuItem>
                    </>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Drops defaults so the request body only carries what the user actually chose. */

/**
 * The chips shown INSIDE the composer, under the text, whenever a non-default option is set:
 * "Sonnet", "Effort: High", "Fast mode" — each with an × that clears just that option. They make
 * the choice impossible to miss at the moment of sending, and cancelling is one click.
 */
export function RunOptionsChips({ value, onChange, disabled, className, v2 = false }: RunOptionsMenuProps & { className?: string }) {
    const t = useT();
    // This app does not know the account's plan; a budget-only account is refused by the API, not hidden here.
    const cheapOnly = false;
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (v2 && !cheapOnly && selectedTier(value) !== "auto") chips.push({ key: "tier", label: t(`engineV2.runTier.${value.modelTier}`), clear: () => onChange({}) });
    if (!v2 && value.model === "sonnet") chips.push({ key: "model", label: t("workspace.chat.runOptions.modelSonnet"), clear: () => onChange(normalizeRunOptions({ ...value, model: undefined })) });
    if (!v2 && value.effort) chips.push({ key: "effort", label: t("workspace.chat.runOptions.chipEffort", { level: t(`workspace.chat.runOptions.effort_${value.effort}`) }), clear: () => onChange(normalizeRunOptions({ ...value, effort: undefined })) });
    if (value.fastMode && (!v2 || (V2_FAST_MODE_AVAILABLE && value.modelTier === "expensive"))) chips.push({ key: "fast", label: t("workspace.chat.runOptions.fastMode"), clear: () => onChange(normalizeRunOptions({ ...value, fastMode: false })) });
    if (!chips.length) return null;
    return (
        <div className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label={t("workspace.chat.runOptions.button")}>
            {chips.map(chip => (
                <span
                    key={chip.key}
                    className="border-primary/25 bg-primary/5 text-primary inline-flex h-6 items-center gap-1 rounded-full border pl-2.5 pr-1 text-xs font-medium"
                >
                    {chip.label}
                    <button
                        type="button"
                        onClick={chip.clear}
                        disabled={disabled}
                        aria-label={t("workspace.chat.runOptions.chipRemove", { option: chip.label })}
                        className="hover:bg-primary/15 focus-visible:ring-primary/40 inline-flex size-4 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                    >
                        <XIcon className="size-3" aria-hidden />
                    </button>
                </span>
            ))}
        </div>
    );
}

const STORAGE_PREFIX = "tp_run_options:";

/**
 * Per-project, per-TAB memory of the picker: `sessionStorage`, so a choice lasts for the working
 * session and never silently follows the user into tomorrow. It is a convenience, not a source of
 * truth — the API defaults apply whenever it is empty or unreadable.
 */
export function useRunOptions(projectId: string): [AgentRunOptions, (next: AgentRunOptions) => void] {
    const key = `${STORAGE_PREFIX}${projectId}`;
    const [options, setOptions] = React.useState<AgentRunOptions>({});

    React.useEffect(() => {
        try {
            const raw = window.sessionStorage.getItem(key);
            setOptions(raw ? normalizeRunOptions(JSON.parse(raw) as AgentRunOptions) : {});
            // Older builds remembered this in localStorage; forget it so nothing sticks across sessions.
            try { window.localStorage.removeItem(key); } catch { /* ignore */ }
        } catch {
            setOptions({});
        }
    }, [key]);

    const update = React.useCallback(
        (next: AgentRunOptions) => {
            const normalized = normalizeRunOptions(next);
            setOptions(normalized);
            try {
                if (Object.keys(normalized).length) window.sessionStorage.setItem(key, JSON.stringify(normalized));
                else window.sessionStorage.removeItem(key);
            } catch {
                /* private mode etc. — the in-memory value still applies for this session */
            }
        },
        [key]
    );

    return [options, update];
}

/**
 * Seed a project's picker from outside its workspace. The /projects composer calls this for
 * the project it just created, so the workspace opens with the same model / effort / fast-mode
 * chips the first prompt was sent with — exactly as if the choice had been made there.
 */
export function rememberRunOptions(projectId: string, options: AgentRunOptions): void {
    const key = `${STORAGE_PREFIX}${projectId}`;
    try {
        const normalized = normalizeRunOptions(options);
        if (Object.keys(normalized).length) window.sessionStorage.setItem(key, JSON.stringify(normalized));
        else window.sessionStorage.removeItem(key);
    } catch {
        /* storage unavailable — the API defaults apply, as with `useRunOptions` */
    }
}
