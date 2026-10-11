"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/i18n";
import {
    isUsableRawValue,
    OPTION_RENDER_LIMIT,
    searchOptions,
    type SearchableOption,
} from "@/lib/option-search";
import { cn } from "@/lib/utils";

/**
 * ═══ A SELECT THAT SURVIVES A HUNDRED THOUSAND OPTIONS ═══════════════════════
 *
 * A trigger, a popover, a search box, and **at most `OPTION_RENDER_LIMIT` rows in
 * the DOM at any moment** — regardless of how many options were handed in.
 *
 * ── WHY NOT A `<select>` ────────────────────────────────────────────────────
 *
 * ⚠️ IT RENDERS EVERY `<option>` EAGERLY, whether or not it is open, and it has
 * no search. On the usage page that was one DOM node per project the account had
 * ever spent on: fine at 20, sluggish at 5 000, and a tab that stops responding
 * somewhere past 100 000. The list is not the user's problem — nobody scrolls a
 * hundred thousand rows — so the fix is to make finding one thing possible and
 * then only render what is being looked at.
 *
 * ── WHY NOT cmdk's OWN FILTERING ────────────────────────────────────────────
 *
 * ⚠️ `shouldFilter` IS OFF ON PURPOSE, and `Command` is not used at all. cmdk
 * scores and re-orders the items it is GIVEN — which means handing it the full
 * list to filter would put the full list in the DOM, the exact thing this
 * component exists to prevent. Filtering happens first, in `searchOptions`, and
 * cmdk never sees more than the slice.
 *
 * ── THE PARTS THAT ARE NOT OBVIOUS ──────────────────────────────────────────
 *
 * ⚠️ THE SELECTED OPTION MAY NOT BE IN `options`. The usage filter can be set to
 * a project id the server truncated out of the list, and a trigger that fell back
 * to the placeholder in that case would tell the user they were looking at
 * everything while they were looking at one project. The trigger renders
 * `selectedLabel ?? value` — never the placeholder — whenever a value is set.
 *
 * ⚠️ `allowRawValue` LETS SOMEONE SELECT WHAT WAS NOT DOWNLOADED. See
 * `isUsableRawValue`: when the list is a truncated view of a larger set, pasting
 * an exact id has to work, or the truncation silently becomes a restriction.
 *
 * ⚠️ THE QUERY RESETS ON CLOSE, not on select. Re-opening a filter and finding
 * last week's search still in the box (and the list still narrowed by it) reads
 * as "these are all my projects" — the most expensive kind of wrong.
 */

export interface SearchableSelectProps<T extends SearchableOption> {
    value: string;
    onValueChange: (value: string) => void;
    options: readonly T[];

    /** Shown on the trigger when `value` is empty. */
    placeholder: string;
    searchPlaceholder?: string;
    /** Accessible name for the trigger. */
    ariaLabel?: string;
    id?: string;

    /**
     * An always-present first row, e.g. "All projects". Selecting it sets `""`.
     * ⚠️ It is OUTSIDE the search: clearing a filter must never require finding
     * the clear option by typing.
     */
    allOptionLabel?: string;

    /** Offer the typed text as a value when nothing matches. See the header. */
    allowRawValue?: boolean;

    /** Rendered under the list when the source is itself incomplete. */
    footnote?: React.ReactNode;

    disabled?: boolean;
    className?: string;
    contentClassName?: string;
    renderOption?: (option: T) => React.ReactNode;
}

export function SearchableSelect<T extends SearchableOption>({
    value,
    onValueChange,
    options,
    placeholder,
    searchPlaceholder,
    ariaLabel,
    id,
    allOptionLabel,
    allowRawValue = false,
    footnote,
    disabled,
    className,
    contentClassName,
    renderOption,
}: SearchableSelectProps<T>) {
    const t = useT();
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [active, setActive] = React.useState(0);

    const listRef = React.useRef<HTMLDivElement>(null);

    const result = React.useMemo(
        () => searchOptions(options, query, OPTION_RENDER_LIMIT),
        [options, query]
    );

    /*
     * ⚠️ A LINEAR SCAN, AND IT IS THE RIGHT CALL. It runs once per render of a
     * closed dropdown, costs ~1ms at 100k, and the alternative — a Map built from
     * `options` — costs the same scan plus an allocation of every key, on a list
     * whose identity changes on every fetch.
     */
    const selected = React.useMemo(
        () => (value ? options.find(option => option.value === value) : undefined),
        [options, value]
    );

    const showRaw = allowRawValue && result.matched === 0 && isUsableRawValue(query);

    /** What ↑/↓/Enter walk over: the "all" row, then the rendered slice, then raw. */
    const rows = React.useMemo(() => {
        const entries: { key: string; value: string; label: string }[] = [];
        if (allOptionLabel && !query.trim()) {
            entries.push({ key: "__all__", value: "", label: allOptionLabel });
        }
        for (const option of result.shown) {
            entries.push({ key: option.value, value: option.value, label: option.label ?? option.value });
        }
        if (showRaw) entries.push({ key: "__raw__", value: query.trim(), label: query.trim() });
        return entries;
    }, [allOptionLabel, query, result.shown, showRaw]);

    React.useEffect(() => setActive(0), [query, open]);

    function commit(next: string) {
        onValueChange(next);
        setOpen(false);
    }

    function handleKeyDown(event: React.KeyboardEvent) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (rows.length === 0) return;
            const delta = event.key === "ArrowDown" ? 1 : -1;
            const next = (active + delta + rows.length) % rows.length;
            setActive(next);
            // Keep the cursor visible without scrolling the page behind the popover.
            listRef.current
                ?.querySelector(`[data-row-index="${next}"]`)
                ?.scrollIntoView({ block: "nearest" });
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            const row = rows[active];
            if (row) commit(row.value);
            return;
        }
        if (event.key === "Escape") setOpen(false);
    }

    return (
        <Popover
            open={open}
            onOpenChange={next => {
                setOpen(next);
                // Reset here rather than in `commit`, so re-opening always starts wide.
                if (!next) setQuery("");
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={ariaLabel}
                    disabled={disabled}
                    className={cn("h-9 justify-between gap-2 font-normal", className)}
                >
                    <span className={cn("min-w-0 truncate", !value && "text-muted-foreground")}>
                        {value ? (selected?.label ?? value) : placeholder}
                    </span>
                    <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" aria-hidden />
                </Button>
            </PopoverTrigger>

            <PopoverContent
                align="end"
                className={cn("w-[min(22rem,calc(100vw-2rem))] p-0", contentClassName)}
                onOpenAutoFocus={event => {
                    // Focus the search box, not the first row: typing is the point.
                    event.preventDefault();
                    (event.currentTarget as HTMLElement)
                        .querySelector<HTMLInputElement>("input")
                        ?.focus();
                }}
            >
                <div className="flex h-9 items-center gap-2 border-b px-3">
                    <SearchIcon className="size-4 shrink-0 opacity-50" aria-hidden />
                    <input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={searchPlaceholder ?? t("common.search")}
                        aria-label={searchPlaceholder ?? t("common.search")}
                        className="placeholder:text-muted-foreground h-9 w-full bg-transparent text-sm outline-hidden"
                    />
                </div>

                <div ref={listRef} className="max-h-64 overflow-x-hidden overflow-y-auto p-1">
                    {rows.length === 0 ? (
                        <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                            {t("common.noResults")}
                        </p>
                    ) : (
                        rows.map((row, index) => {
                            const option = result.shown.find(entry => entry.value === row.value);
                            const isSelected = row.value === value;

                            return (
                                <button
                                    key={row.key}
                                    type="button"
                                    data-row-index={index}
                                    onMouseEnter={() => setActive(index)}
                                    onClick={() => commit(row.value)}
                                    className={cn(
                                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                                        index === active && "bg-accent text-accent-foreground"
                                    )}
                                >
                                    <CheckIcon
                                        className={cn(
                                            "size-4 shrink-0",
                                            isSelected ? "opacity-100" : "opacity-0"
                                        )}
                                        aria-hidden
                                    />
                                    <span className="min-w-0 flex-1">
                                        {option && renderOption ? (
                                            renderOption(option)
                                        ) : (
                                            <span className="block truncate">{row.label}</span>
                                        )}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>

                {/*
                  ⚠️ "…AND N MORE" IS NOT A NICETY. The list is capped, so without
                  this line a search that matched 4 000 projects and showed 50 looks
                  identical to one that matched exactly 50 — and someone would
                  reasonably conclude the project they want does not exist.
                */}
                {(result.hidden > 0 || footnote) && (
                    <div className="text-muted-foreground border-t px-3 py-2 text-xs">
                        {result.hidden > 0 && (
                            <p>{t("common.moreResults", { count: result.hidden })}</p>
                        )}
                        {footnote}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
