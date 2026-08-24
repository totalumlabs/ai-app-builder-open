"use client";

import * as React from "react";
import {
    AArrowDownIcon,
    AArrowUpIcon,
    HelpCircleIcon,
    ImageIcon,
    LoaderIcon,
    MousePointerClickIcon,
    PaletteIcon,
    PencilIcon,
    SparklesIcon,
    TypeIcon,
    UploadIcon,
    XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/primitives";
import { useT } from "@/i18n";
import { currentTextSize, setColorClass, stepTextSize } from "@/lib/visual-edit";
import { uploadFileToProject } from "@/lib/upload";
import { cn } from "@/lib/utils";

import type { SelectedElement } from "./use-visual-editor";
import type { VisualChangeKind } from "@/lib/visual-edit";

/**
 * ═══ THE INSPECTOR (Feature F12) ════════════════════════════════════════════
 *
 * What you can do to the element you picked: its text, its size, its colours, its
 * image or video, and a question about it for the agent.
 *
 * ⚠️ IT NEVER SITS ON TOP OF THE PREVIEW. The brief asks for an inspector that
 * does not obscure what is being edited, so on desktop it is a COLUMN beside the
 * frame and on mobile a bottom sheet with the frame above it — never an overlay. An
 * element you cannot see while you edit it is the one thing a visual editor must not
 * do.
 *
 * ⚠️ COLOURS AND SIZES ARE TAILWIND CLASS EDITS, NOT INLINE STYLES. An inline
 * style would beat the project's own responsive classes and look broken on a phone,
 * and it would be unmappable back to source. See `setColorClass` / `stepTextSize`.
 */

/** Long enough that typing is smooth, short enough that the preview feels live. */
const TEXT_PREVIEW_DEBOUNCE_MS = 220;

export interface VisualEditorPanelProps {
    /** The project the image field uploads into. */
    projectId: string;
    selected: SelectedElement | null;
    ready: boolean;
    locked: boolean;
    /** G4 — the colours this project already uses, harvested from the live page. */
    palette: string[];
    onChange: (kind: VisualChangeKind, before: string, after: string, options?: { uploaded?: boolean }) => void;
    onAskAi: (prompt: string) => void;
    onClose: () => void;
}

export function VisualEditorPanel({
    projectId,
    selected,
    ready,
    locked,
    palette,
    onChange,
    onAskAi,
    onClose,
}: VisualEditorPanelProps) {
    const t = useT();
    const [draftText, setDraftText] = React.useState("");
    const [draftSrc, setDraftSrc] = React.useState("");
    const [question, setQuestion] = React.useState("");

    const signature = selected?.signature;

    // Reseed when the selection changes — never while the user is typing into it.
    React.useEffect(() => {
        setDraftText(signature?.text ?? "");
        setDraftSrc(signature?.src ?? "");
        setQuestion("");
    }, [signature?.breadcrumb, signature?.text, signature?.src]);

    /**
     * ⭐ G4 — TEXT PREVIEWS LIVE, DEBOUNCED.
     *
     * It used to commit on blur only, so you typed a heading into a box and the page
     * behind it did not move until you clicked away — which is the opposite of what a
     * visual editor is for. Every keystroke now pushes to the preview after a short
     * pause.
     *
     * ⚠️ THE DEBOUNCE IS WHAT MAKES IT SAFE, not just cheap. `pushChange` collapses
     * consecutive edits to the same property of the same element, so typing does not
     * create thirty entries in the bar — but each push is still a `postMessage` and a
     * React state update, and firing one per keystroke would make a long heading
     * stutter.
     */
    const liveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    React.useEffect(() => () => { if (liveTimer.current) clearTimeout(liveTimer.current); }, []);

    const previewText = (next: string) => {
        setDraftText(next);
        if (!signature?.text) return;
        if (liveTimer.current) clearTimeout(liveTimer.current);
        liveTimer.current = setTimeout(() => {
            // `signature.text` is re-read at fire time: the agent re-describes after
            // every apply, so the committed `before` always matches what is on screen.
            if (next !== signature.text) onChange("text", signature.text, next);
        }, TEXT_PREVIEW_DEBOUNCE_MS);
    };

    const commitText = () => {
        if (liveTimer.current) clearTimeout(liveTimer.current);
        if (!signature?.text || draftText === signature.text) return;
        onChange("text", signature.text, draftText);
    };

    const commitSrc = () => {
        if (!signature?.src || !draftSrc || draftSrc === signature.src) return;
        onChange("src", signature.src, draftSrc);
    };

    /**
     * ⚠️⚠️ A CLASS EDIT ON AN ELEMENT WITH NO CLASS ATTRIBUTE CAN NEVER BE SAVED, and
     * before this the panel offered it anyway.
     *
     * The matcher finds a class edit by searching the source for the attribute value it
     * started from. With no class attribute that value is the empty string,
     * `findClassCandidates` returns immediately on an empty needle, and the change comes
     * back `not-found` with `occurrences: 0` — AFTER the user picked a colour, watched
     * the preview change, and pressed Apply. The work was always going to be thrown away;
     * the only honest thing is to say so beforehand.
     *
     * ⚠️ THIS IS A REFUSAL, NOT A FIX. Adding a class attribute where none exists means
     * locating the element's opening tag in the source from its text alone and injecting
     * an attribute — a real feature, and a riskier one than anything the matcher does
     * today. Until it exists, the AI box below is the path that works, and the hint
     * points at it.
     */
    const canEditClasses = !!signature?.className;

    const stepSize = (direction: 1 | -1) => {
        if (!signature?.className) return;
        onChange("class", signature.className, stepTextSize(signature.className, direction));
    };

    const setColor = (kind: "text" | "bg", hex: string) => {
        if (!signature?.className) return;
        onChange("class", signature.className, setColorClass(signature.className, kind, hex));
    };

    return (
        <aside
            className="bg-card border-border/60 flex h-full min-h-0 w-full flex-col border-l"
            aria-label={t("workspace.visualEditor.panelLabel")}
        >
            <header className="border-border/60 flex shrink-0 items-center gap-2 border-b px-3 py-2">
                {/* The pencil, matching the composer's toggle — one icon means one feature. */}
                <PencilIcon className="text-primary size-4 shrink-0" aria-hidden />
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {t("workspace.visualEditor.title")}
                </h2>
                <VisualEditorHelp />
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={onClose}
                    aria-label={t("workspace.visualEditor.close")}
                >
                    <XIcon className="size-4" aria-hidden />
                </Button>
            </header>

            <div className="tp-scroll min-h-0 flex-1 overflow-y-auto p-3">
                {!ready && (
                    <div className="flex items-center gap-2 py-6 text-sm">
                        <LoaderIcon className="text-muted-foreground size-4 animate-spin" aria-hidden />
                        <span className="text-muted-foreground">
                            {t("workspace.visualEditor.connecting")}
                        </span>
                    </div>
                )}

                {ready && !selected && (
                    <EmptyState
                        variant="panel"
                        className="w-full min-w-0"
                        icon={<MousePointerClickIcon />}
                        title={t("workspace.visualEditor.pickTitle")}
                        description={t("workspace.visualEditor.pickDescription")}
                    />
                )}

                {ready && selected && signature && (
                    <div className={cn("space-y-5", locked && "pointer-events-none opacity-50")}>
                        {/* ── Breadcrumb ──────────────────────────────── */}
                        <div>
                            <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                                {t("workspace.visualEditor.selection")}
                            </p>
                            <p className="mt-1 truncate font-mono text-xs" title={signature.breadcrumb}>
                                {signature.breadcrumb}
                            </p>
                        </div>

                        {/* ── Text ────────────────────────────────────── */}
                        {selected.editable.text ? (
                            <div className="space-y-2">
                                <Label htmlFor="ve-text" className="flex items-center gap-1.5 text-xs">
                                    <TypeIcon className="size-3.5" aria-hidden />
                                    {t("workspace.visualEditor.text")}
                                </Label>
                                <Textarea
                                    id="ve-text"
                                    value={draftText}
                                    onChange={event => previewText(event.target.value)}
                                    onBlur={commitText}
                                    onKeyDown={event => {
                                        if (event.key === "Escape") {
                                            setDraftText(signature.text ?? "");
                                            event.currentTarget.blur();
                                        }
                                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                            commitText();
                                        }
                                    }}
                                    rows={3}
                                    className="text-sm"
                                />
                                <p className="text-muted-foreground text-[11px]">
                                    {t("workspace.visualEditor.textHint")}
                                </p>
                            </div>
                        ) : (
                            /*
                              ⭐ G4 — DON'T TELL AN <img> THAT IT "WRAPS OTHER ELEMENTS".
                              This hint reads as an instruction ("pick the heading inside
                              it"), so showing it on something with nothing inside is a
                              small lie that sends the user hunting. Two cases are excluded:
                              a media element (its own field is right below, and it has no
                              children by definition), and the total dead end (no text, no
                              media, no class) which gets the far more useful card below.
                            */
                            !selected.editable.media &&
                            !!signature.className && (
                                <p className="text-muted-foreground text-xs">
                                    {t("workspace.visualEditor.noTextHint")}
                                </p>
                            )
                        )}

                        {/*
                          ⭐ G4 — THE DEAD-END CASE, MADE USEFUL.
                          An element with no own text, no media and no class attribute
                          has nothing this panel can change: the size and colour controls
                          would write a class onto an element the matcher cannot find, and
                          the user would get "we couldn't place this" after doing the work.
                          Say so first, and hand them the tool that CAN do it.
                        */}
                        {!selected.editable.text && !selected.editable.media && !signature.className && (
                            <div className="border-warning/30 bg-warning-subtle/40 space-y-2 rounded-lg border p-3">
                                <p className="text-warning-subtle-foreground text-xs font-medium">
                                    {t("workspace.visualEditor.unsupportedTitle")}
                                </p>
                                <p className="text-muted-foreground text-[11px]">
                                    {t("workspace.visualEditor.unsupportedBody")}
                                </p>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() =>
                                        onAskAi(
                                            t("workspace.visualEditor.askPrompt", {
                                                question: "",
                                                route: signature.route,
                                                element: signature.breadcrumb,
                                                text: signature.text ?? "—",
                                                classes: signature.className ?? "—",
                                            })
                                        )
                                    }
                                >
                                    <SparklesIcon className="size-3.5" aria-hidden />
                                    {t("workspace.visualEditor.unsupportedAction")}
                                </Button>
                            </div>
                        )}

                        {/* ── Size ────────────────────────────────────── */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5 text-xs">
                                <AArrowUpIcon className="size-3.5" aria-hidden />
                                {t("workspace.visualEditor.size")}
                            </Label>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!canEditClasses}
                                    onClick={() => stepSize(-1)}
                                    aria-label={t("workspace.visualEditor.smaller")}
                                >
                                    <AArrowDownIcon className="size-4" aria-hidden />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!canEditClasses}
                                    onClick={() => stepSize(1)}
                                    aria-label={t("workspace.visualEditor.bigger")}
                                >
                                    <AArrowUpIcon className="size-4" aria-hidden />
                                </Button>
                                {/* The live computed size, so a step is legible even when
                                    the edited element is scrolled out of the frame. */}
                                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                                    {currentTextSize(signature.className) ?? selected.computed.fontSize}
                                </span>
                            </div>
                        </div>

                        {/* ── Colours ─────────────────────────────────── */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5 text-xs">
                                <PaletteIcon className="size-3.5" aria-hidden />
                                {t("workspace.visualEditor.colors")}
                            </Label>
                            <div className="space-y-3">
                                <ColorField
                                    label={t("workspace.visualEditor.textColor")}
                                    value={toHex(selected.computed.color)}
                                    palette={palette}
                                    disabled={locked || !canEditClasses}
                                    onCommit={hex => setColor("text", hex)}
                                />
                                <ColorField
                                    label={t("workspace.visualEditor.bgColor")}
                                    value={toHex(selected.computed.backgroundColor)}
                                    palette={palette}
                                    disabled={locked || !canEditClasses}
                                    onCommit={hex => setColor("bg", hex)}
                                />
                            </div>

                            {/* Says why the row above is dead, and points at what works. */}
                            {!canEditClasses && (
                                <p className="text-muted-foreground text-[11px]">
                                    {t("workspace.visualEditor.noClassHint")}
                                </p>
                            )}
                        </div>

                        {/* ── Media ───────────────────────────────────── */}
                        {selected.editable.media && (
                            <div className="space-y-2">
                                <Label htmlFor="ve-src" className="flex items-center gap-1.5 text-xs">
                                    <ImageIcon className="size-3.5" aria-hidden />
                                    {t("workspace.visualEditor.media")}
                                </Label>
                                <Input
                                    id="ve-src"
                                    value={draftSrc}
                                    onChange={event => setDraftSrc(event.target.value)}
                                    onBlur={commitSrc}
                                    onKeyDown={event => {
                                        if (event.key === "Enter") commitSrc();
                                        if (event.key === "Escape") setDraftSrc(signature.src ?? "");
                                    }}
                                    placeholder={t("workspace.visualEditor.mediaPlaceholder")}
                                    className="text-xs"
                                />

                                <ImageDropzone
                                    projectId={projectId}
                                    disabled={locked}
                                    onUploaded={url => {
                                        setDraftSrc(url);
                                        // Commit against the CURRENT signature rather than
                                        // the stale draft: an upload is a decision, and
                                        // waiting for a blur would lose it if the user
                                        // pressed Apply next.
                                        if (signature.src && signature.src !== url) {
                                            // ⭐ G6 — `uploaded` is what tells the apply
                                            // route to copy this into `public/` instead
                                            // of writing our signed storage url into
                                            // their source. See `VisualChange.uploaded`.
                                            onChange("src", signature.src, url, { uploaded: true });
                                        }
                                    }}
                                />

                                <p className="text-muted-foreground text-[11px]">
                                    {t("workspace.visualEditor.mediaHint")}
                                </p>
                            </div>
                        )}

                        {/* ── Ask the AI about THIS block ─────────────── */}
                        <div className="border-border/60 space-y-2 border-t pt-4">
                            <Label htmlFor="ve-ask" className="flex items-center gap-1.5 text-xs">
                                <SparklesIcon className="size-3.5" aria-hidden />
                                {t("workspace.visualEditor.askTitle")}
                            </Label>
                            <Textarea
                                id="ve-ask"
                                value={question}
                                onChange={event => setQuestion(event.target.value)}
                                onKeyDown={event => {
                                    if (event.key === "Escape") setQuestion("");
                                }}
                                rows={2}
                                placeholder={t("workspace.visualEditor.askPlaceholder")}
                                className="text-sm"
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                disabled={!question.trim()}
                                onClick={() => {
                                    /**
                                     * ⭐ THE SCOPE IS THE POINT. The prompt carries the
                                     * element's route, tag, classes and text, so the agent
                                     * edits THIS block instead of guessing which "the
                                     * heading" the user meant.
                                     */
                                    onAskAi(
                                        t("workspace.visualEditor.askPrompt", {
                                            question: question.trim(),
                                            route: signature.route,
                                            element: signature.breadcrumb,
                                            text: signature.text ?? "—",
                                            classes: signature.className ?? "—",
                                        })
                                    );
                                    setQuestion("");
                                }}
                            >
                                <SparklesIcon className="size-3.5" aria-hidden />
                                {t("workspace.visualEditor.askSend")}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}

/**
 * ═══ DROP AN IMAGE, OR PICK ONE ═════════════════════════════════════════════
 *
 * The url field alone assumed the picture was already on the internet somewhere. It
 * usually is not: the user has it on their desktop, and "upload it, host it, get a
 * url, paste the url" is four steps of someone else's job. This uploads into the
 * project's own storage and puts the returned url straight into the field.
 *
 * ⚠️ THE WHOLE PANEL IS NOT A DROP TARGET, only this box. A page-wide drop zone in a
 * workspace that already accepts files in the chat composer makes "where did that go?"
 * a coin toss.
 *
 * ⚠️ `dragover` MUST BE PREVENTED OR THE BROWSER NAVIGATES. Dropping an image on a
 * document with no handler replaces the page with the image — losing every unsaved
 * change in the bar. That single `preventDefault` is the difference between a feature
 * and a data-loss bug, which is why the counter is on the whole box and not just the
 * button.
 *
 * ⚠️ IT COSTS 0.5 CREDITS UPSTREAM (`VCAAS_CREDIT_COSTS.UPLOAD_FILE`), the same as any
 * other attachment, and the hint says so.
 */
const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm";

/** Refuse locally rather than spend a round trip and a credit on a doomed upload. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function ImageDropzone({
    projectId,
    disabled,
    onUploaded,
}: {
    projectId: string;
    disabled?: boolean;
    onUploaded: (url: string) => void;
}) {
    const t = useT();
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    /** Guards against `setState` after the panel swapped to another element. */
    const mounted = React.useRef(true);
    React.useEffect(() => () => { mounted.current = false; }, []);

    async function take(file: File | undefined) {
        if (!file || disabled || uploading) return;
        setError(null);

        if (!/^(image|video)\//.test(file.type)) {
            return setError(t("workspace.visualEditor.mediaNotAnImage"));
        }
        if (file.size > MAX_IMAGE_BYTES) {
            return setError(
                t("workspace.visualEditor.mediaTooLarge", {
                    size: Math.floor(MAX_IMAGE_BYTES / 1024 / 1024),
                })
            );
        }

        setUploading(true);
        const uploaded = await uploadFileToProject(projectId, file);
        if (!mounted.current) return;
        setUploading(false);

        if (!uploaded?.url) return setError(t("workspace.visualEditor.mediaUploadFailed"));
        onUploaded(uploaded.url);
    }

    return (
        <div className="space-y-1.5">
            <div
                /**
                 * ⚠️ THE CHAT COMPOSER NOW ACCEPTS A DROP ANYWHERE ON THE PAGE, and
                 * this marker is what keeps that out of here: its window handler
                 * ignores any drop that lands inside a `[data-dropzone]` other than
                 * its own. Without it, dropping an image on this box would attach it
                 * to the prompt as well as setting the field.
                 */
                data-dropzone="visual-editor-media"
                onDragOver={event => {
                    // See the note above — without this the browser opens the file.
                    event.preventDefault();
                    if (!disabled) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={event => {
                    event.preventDefault();
                    setDragging(false);
                    void take(event.dataTransfer.files?.[0]);
                }}
                className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
                    dragging ? "border-primary bg-primary-subtle" : "border-border/70",
                    disabled && "opacity-50"
                )}
            >
                {uploading ? (
                    <LoaderIcon className="text-muted-foreground size-4 animate-spin" aria-hidden />
                ) : (
                    <UploadIcon className="text-muted-foreground size-4" aria-hidden />
                )}

                <p className="text-muted-foreground text-[11px]">
                    {uploading
                        ? t("workspace.visualEditor.mediaUploading")
                        : t("workspace.visualEditor.mediaDrop")}
                </p>

                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-1 h-7 text-[11px]"
                    disabled={disabled || uploading}
                    onClick={() => inputRef.current?.click()}
                >
                    {t("workspace.visualEditor.mediaBrowse")}
                </Button>

                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    className="hidden"
                    onChange={event => {
                        void take(event.target.files?.[0]);
                        // Reset so choosing the SAME file twice fires `change` again.
                        event.target.value = "";
                    }}
                />
            </div>

            {error ? (
                <p role="alert" className="text-destructive text-[11px]">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

/**
 * ═══ THE COLOUR CONTROL (G4) ════════════════════════════════════════════════
 *
 * ⭐ THE PROJECT'S OWN PALETTE COMES FIRST, and that is the whole point of the
 * rewrite. It used to be a bare `<input type="color">` — a 16-million-colour wheel
 * that asks someone to invent a shade with no relationship to their design. The
 * colours the page already uses are harvested from its computed styles by the agent
 * and offered as swatches; the wheel is still there, one click away, for the times
 * the answer genuinely is a new colour.
 *
 * ⚠️ THE CURRENT VALUE IS MARKED, not merely stored, so "what is it now" is
 * answerable without opening anything.
 *
 * ⚠️ COMMITTED ON SELECTION, NOT ON BLUR. The old field committed in `onBlur`, which
 * meant clicking a swatch and then clicking Apply lost the edit unless focus happened
 * to move first — and the comment above it claimed it committed live, which it did
 * not. A swatch is a decision; it applies immediately and the preview follows.
 */
function ColorField({
    label,
    value,
    palette,
    disabled,
    onCommit,
}: {
    label: string;
    value: string;
    palette: string[];
    disabled?: boolean;
    onCommit: (hex: string) => void;
}) {
    const t = useT();
    const [open, setOpen] = React.useState(false);
    const [draft, setDraft] = React.useState(value);

    React.useEffect(() => setDraft(value), [value]);

    // The element's own colour belongs in the row even when the harvest missed it
    // (a one-off colour used exactly once is still the answer to "what is it now").
    const swatches = React.useMemo(() => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const hex of [value, ...palette]) {
            const key = hex.toLowerCase();
            if (!/^#[0-9a-f]{6}$/i.test(hex) || seen.has(key)) continue;
            seen.add(key);
            out.push(hex);
        }
        return out.slice(0, 10);
    }, [value, palette]);

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-[11px]">{label}</span>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setOpen(value_ => !value_)}
                    aria-expanded={open}
                    className="text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 hover:underline disabled:opacity-50"
                >
                    {t(open ? "workspace.visualEditor.colorHideCustom" : "workspace.visualEditor.colorCustom")}
                </button>
            </div>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
                {swatches.map(hex => {
                    const isCurrent = hex.toLowerCase() === value.toLowerCase();
                    return (
                        <button
                            key={hex}
                            type="button"
                            disabled={disabled}
                            onClick={() => onCommit(hex)}
                            title={hex}
                            aria-label={`${label}: ${hex}`}
                            aria-pressed={isCurrent}
                            className={cn(
                                "focus-visible:ring-ring size-6 rounded-md border transition-transform focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50",
                                "motion-safe:hover:scale-110",
                                isCurrent
                                    ? "border-primary ring-primary/40 ring-2 ring-offset-1"
                                    : "border-border/70"
                            )}
                            style={{ backgroundColor: hex }}
                        />
                    );
                })}
            </div>

            {open && (
                <div className="flex items-center gap-2 pt-0.5">
                    <input
                        type="color"
                        value={draft}
                        disabled={disabled}
                        onChange={event => setDraft(event.target.value)}
                        // `change` fires continuously while the native wheel is open;
                        // committing there would push a change per pixel of drag. The
                        // decision is made when the picker closes.
                        onBlur={() => draft.toLowerCase() !== value.toLowerCase() && onCommit(draft)}
                        aria-label={t("workspace.visualEditor.colorCustom")}
                        className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <code className="text-muted-foreground text-[11px]">{draft}</code>
                    <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto h-6 text-[11px]"
                        disabled={disabled || draft.toLowerCase() === value.toLowerCase()}
                        onClick={() => onCommit(draft)}
                    >
                        {t("workspace.visualEditor.colorApply")}
                    </Button>
                </div>
            )}
        </div>
    );
}

/**
 * `rgb(37, 99, 235)` → `#2563eb`.
 *
 * ⚠️ `getComputedStyle` NEVER RETURNS HEX, and `<input type="color">` accepts
 * nothing else — without this the picker silently falls back to black and the user's
 * first edit sets a colour they did not choose.
 */
export function toHex(color: string): string {
    if (!color) return "#000000";
    if (color.startsWith("#")) return color.slice(0, 7);

    const match = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!match) return "#000000";

    const [, r, g, b] = match;
    const hex = (value: string) => Number(value).toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * ═══ THE HELP POPOVER (G4) ══════════════════════════════════════════════════
 *
 * ⭐ IT LEADS WITH THE LIMITS, NOT THE FEATURES. A visual editor that silently
 * refuses a change teaches people it is unreliable; one that says up front "I can't
 * move elements, and I can't read classes built by cn()" turns the same refusal into
 * an expectation being met. Both lists are short and concrete for that reason.
 *
 * ⚠️ THE PRICE IS IN HERE, in words, because it is the only thing in this panel that
 * costs money and the brief asks for it to be stated.
 */
function VisualEditorHelp() {
    const t = useT();

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t("workspace.visualEditor.helpOpen")}
                >
                    <HelpCircleIcon className="size-4" aria-hidden />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 text-sm">
                <h3 className="font-display text-sm font-semibold">
                    {t("workspace.visualEditor.helpTitle")}
                </h3>
                <p className="text-muted-foreground mt-1.5 text-xs">
                    {t("workspace.visualEditor.helpIntro")}
                </p>

                <div className="mt-3 space-y-3">
                    <div>
                        <p className="text-success text-[11px] font-semibold tracking-wide uppercase">
                            {t("workspace.visualEditor.helpCanTitle")}
                        </p>
                        <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                            <li>· {t("workspace.visualEditor.helpCan1")}</li>
                            <li>· {t("workspace.visualEditor.helpCan2")}</li>
                            <li>· {t("workspace.visualEditor.helpCan3")}</li>
                        </ul>
                    </div>

                    <div>
                        <p className="text-warning-subtle-foreground text-[11px] font-semibold tracking-wide uppercase">
                            {t("workspace.visualEditor.helpCantTitle")}
                        </p>
                        <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                            <li>· {t("workspace.visualEditor.helpCant1")}</li>
                            <li>· {t("workspace.visualEditor.helpCant2")}</li>
                            <li>· {t("workspace.visualEditor.helpCant3")}</li>
                        </ul>
                    </div>
                </div>

                <p className="border-border/60 text-muted-foreground mt-3 border-t pt-2.5 text-[11px]">
                    {t("workspace.visualEditor.helpCost")}
                </p>
            </PopoverContent>
        </Popover>
    );
}
