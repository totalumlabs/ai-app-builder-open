"use client";

import * as React from "react";
import {
    ArrowDownIcon,
    CloudIcon,
    DownloadIcon,
    LoaderIcon,
    RefreshCwIcon,
    RocketIcon,
    SearchIcon,
    TerminalIcon,
    XIcon,
} from "lucide-react";
import { CopyButton, EmptyState, ErrorState } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLocale, useT } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import { formatRelativeDate } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    DEFAULT_PROD_RANGE_HOURS,
    devLogLines,
    extractProdRecords,
    filterLines,
    linesToText,
    PROD_RANGE_HOURS,
    prodLogLines,
    prodRangeFrom,
    type LogLevel,
    type LogLine,
    type ProdRangeHours,
} from "@/lib/logs";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import type { VcaasErrorCode } from "@/lib/vcaas-errors";
import { cn } from "@/lib/utils";

/**
 * THE SERVER LOGS — DEVELOPMENT **AND** PRODUCTION (Feature F9).
 *
 * ⚠️⚠️ PHASE 09 SHIPPED ONE TAB ON A FALSE PREMISE, and this is the correction.
 * It assumed the dev server "on PORT 80 serves both the preview and the published
 * site", so one endpoint covered everything. The upstream handlers say otherwise:
 * dev logs are `cat npm-start.log` on the sandbox VM, production logs come from a
 * Cloudflare Logpush worker because a deployed project runs on Cloudflare. Someone
 * debugging their live site on the old single tab was reading the wrong machine.
 * See `@/lib/logs` for the evidence and `vcaasApi.logs` for the endpoints.
 *
 * ── ONE RENDERER, TWO SOURCES ───────────────────────────────────────────────
 *
 * Dev is a text blob; production is structured request records. Both are flattened
 * to `LogLine[]` in `@/lib/logs`, so search, colouring, copy, download, autoscroll
 * and the jump pill are written once and behave identically in both tabs.
 *
 * ── PRODUCTION ALWAYS SENDS AN EXPLICIT TIME RANGE ──────────────────────────
 *
 * ⚠️ A production fetch with no `from` is answered from the LAST SIX HOURS, not
 * the three days this panel's copy promises — see the long note on
 * `PROD_RANGE_HOURS` in `@/lib/logs`. That is why a deployed, genuinely-visited
 * site could read as "nothing from production yet". Every production request now
 * carries a range the user picked, defaulting to 24 h.
 *
 * ── SEARCH MEANS SOMETHING DIFFERENT IN EACH TAB, DELIBERATELY ──────────────
 *
 * Dev filters the blob we already hold — everything is there. Production only ever
 * returns the most recent slice, so filtering that client-side would answer "no
 * matches" for something that IS in the window. The production search is therefore
 * sent upstream as `regexSearch`, which scans the whole three-day window; the hint
 * under the field says so rather than leaving the user to discover it.
 *
 * ── AUTO-REFRESH IS OFF BY DEFAULT, AND SLOWER FOR PRODUCTION ───────────────
 *
 * Each poll is a VCaaS call plus a bridge round trip to mint a key, and production
 * additionally counts against a **per-plan log-request limit** (upstream answers
 * 429 when it is reached). So the user opts in, it pauses on a hidden tab, and
 * production polls at a third of the dev rate.
 *
 * ── AUTOSCROLL ONLY WHEN ALREADY AT THE BOTTOM ──────────────────────────────
 *
 * Same rule as the chat: scrolling someone back down while they are reading a stack
 * trace is worse than not following the tail. A "jump to latest" pill appears
 * instead.
 */

const DEV_REFRESH_MS = 10_000;
/** Production polls slower: Logpush lags by minutes and the plan limit is finite. */
const PROD_REFRESH_MS = 30_000;
/** Within this many px of the bottom counts as "following the tail". */
const BOTTOM_THRESHOLD_PX = 40;
/** Typing pause before a production search goes upstream. */
const SEARCH_DEBOUNCE_MS = 500;

type Source = "dev" | "prod";

const SOURCES: { id: Source; labelKey: TranslationKey; icon: typeof TerminalIcon }[] = [
    { id: "dev", labelKey: "workspace.logs.sourceDev", icon: TerminalIcon },
    { id: "prod", labelKey: "workspace.logs.sourceProd", icon: CloudIcon },
];

const LEVEL_CLASS: Record<LogLevel, string> = {
    error: "text-rose-600 dark:text-rose-400",
    warn: "text-amber-600 dark:text-amber-400",
    info: "text-emerald-600 dark:text-emerald-400",
    debug: "text-muted-foreground",
    plain: "text-foreground/80",
};

interface SourceState {
    lines: LogLine[];
    fetched: boolean;
    error: string | null;
    /** The normalised VCaaS code, so 429 and 404 get their own copy. */
    errorCode: VcaasErrorCode | null;
    updatedAt: number | null;
}

const EMPTY_STATE: SourceState = {
    lines: [],
    fetched: false,
    error: null,
    errorCode: null,
    updatedAt: null,
};

export interface LogsPanelProps {
    projectId: string;
    /**
     * Has this project ever been published? Lets the production tab say "you have
     * not deployed yet" instead of "no logs found" — different problems with
     * different next steps.
     *
     * ⚠️ OPTIONAL, AND `undefined` MEANS "WE DON'T KNOW". The panel then makes no
     * claim either way rather than guessing, because telling someone with a live
     * site that they have never deployed is worse than saying nothing.
     */
    hasBeenDeployed?: boolean;
}

export function LogsPanel({ projectId, hasBeenDeployed }: LogsPanelProps) {
    const t = useT();
    const { locale } = useLocale();

    const [source, setSource] = React.useState<Source>("dev");
    const [state, setState] = React.useState<Record<Source, SourceState>>({
        dev: EMPTY_STATE,
        prod: EMPTY_STATE,
    });
    const [loading, setLoading] = React.useState(false);
    const [autoRefresh, setAutoRefresh] = React.useState(false);
    const [search, setSearch] = React.useState("");
    /** How far back the production tab looks. Ignored by the dev tab entirely. */
    const [rangeHours, setRangeHours] = React.useState<ProdRangeHours>(DEFAULT_PROD_RANGE_HOURS);
    const [atBottom, setAtBottom] = React.useState(true);
    const [hasNew, setHasNew] = React.useState(false);
    /** Ticks once a minute so "updated 2 minutes ago" stays true without a re-fetch. */
    const [, setClock] = React.useState(0);

    const scrollRef = React.useRef<HTMLDivElement>(null);
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const mounted = React.useRef(true);
    const atBottomRef = React.useRef(true);
    const sourceRef = React.useRef<Source>(source);
    sourceRef.current = source;

    const current = state[source];

    React.useEffect(() => {
        mounted.current = true;
        const clock = setInterval(() => setClock(value => value + 1), 60_000);
        return () => {
            mounted.current = false;
            clearInterval(clock);
            if (timer.current) clearTimeout(timer.current);
        };
    }, []);

    // ── Fetching ──────────────────────────────────────────────────────────
    const fetchLogs = React.useCallback(
        async (target: Source, query: string, hours: ProdRangeHours) => {
            setLoading(true);

            const response =
                target === "dev"
                    ? await vcaasApi.logs.dev(projectId)
                    : await vcaasApi.logs.prod(projectId, {
                          /**
                           * ⚠️ `from` IS THE ONLY THING THAT SETS THE WINDOW. Without
                           * it the worker answers from the last six hours regardless
                           * of what else is sent — see `@/lib/logs`.
                           *
                           * Computed per fetch, not memoised: "the last 24 hours" has
                           * to mean 24 hours from *this* refresh.
                           */
                          from: prodRangeFrom(hours),
                          /**
                           * ⚠️ `getOnlyLastLogs` GOES OFF WHEN SEARCHING. The worker
                           * ignores this flag, but account-backend and totalum-backend
                           * both forward it, so it stays honest about intent — the
                           * same pairing the legacy panel uses (`hasFilters` →
                           * `getOnlyLastLogs: false`).
                           */
                          getOnlyLastLogs: !query.trim(),
                          ...(query.trim() ? { regexSearch: query.trim() } : {}),
                      });

            if (!mounted.current) return;

            setState(previous => {
                const before = previous[target];

                if (!response.ok) {
                    return {
                        ...previous,
                        [target]: {
                            ...before,
                            fetched: true,
                            error: response.error || t("workspace.logs.fetchFailed"),
                            errorCode: response.code ?? null,
                        },
                    };
                }

                const lines =
                    target === "dev"
                        ? devLogLines((response.data as { logs?: string } | undefined)?.logs ?? "")
                        : prodLogLines(extractProdRecords(response.data), locale);

                // Only flag "new content" when something actually changed AND the
                // user is not already following the tail.
                if (
                    target === sourceRef.current &&
                    !atBottomRef.current &&
                    lines.length !== before.lines.length
                ) {
                    setHasNew(true);
                }

                return {
                    ...previous,
                    [target]: {
                        lines,
                        fetched: true,
                        error: null,
                        errorCode: null,
                        updatedAt: Date.now(),
                    },
                };
            });

            setLoading(false);
        },
        [projectId, locale, t]
    );

    /** Refresh whatever is on screen, with whatever is in the search box. */
    const refresh = React.useCallback(
        () => fetchLogs(sourceRef.current, search, rangeHours),
        [fetchLogs, search, rangeHours]
    );

    // ── Production search runs upstream, so it is debounced ────────────────
    const firstSearch = React.useRef(true);
    React.useEffect(() => {
        if (firstSearch.current) {
            firstSearch.current = false;
            return;
        }
        // Dev filters what we already hold — no request, no debounce.
        if (source !== "prod" || !state.prod.fetched) return;

        const handle = setTimeout(() => void fetchLogs("prod", search, rangeHours), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, source, rangeHours]);

    // ── Auto-refresh, paused while the tab is hidden ──────────────────────
    React.useEffect(() => {
        if (!autoRefresh) {
            if (timer.current) clearTimeout(timer.current);
            return;
        }

        let cancelled = false;
        const interval = source === "prod" ? PROD_REFRESH_MS : DEV_REFRESH_MS;

        const tick = async () => {
            if (cancelled) return;
            if (typeof document !== "undefined" && document.hidden) {
                timer.current = setTimeout(tick, interval);
                return;
            }
            await refresh();
            if (!cancelled) timer.current = setTimeout(tick, interval);
        };

        timer.current = setTimeout(tick, interval);

        return () => {
            cancelled = true;
            if (timer.current) clearTimeout(timer.current);
        };
    }, [autoRefresh, refresh, source]);

    // ── Switching tabs ────────────────────────────────────────────────────
    function selectSource(next: Source) {
        if (next === source) return;
        setSource(next);
        setHasNew(false);
        atBottomRef.current = true;
        setAtBottom(true);
        /**
         * ⚠️ THE OTHER TAB'S LINES ARE KEPT, not discarded: coming back to dev after
         * a look at production should not cost another round trip. Only a tab that
         * has never loaded fetches on arrival.
         */
        if (!state[next].fetched) void fetchLogs(next, next === "prod" ? search : "", rangeHours);
    }

    // ── Filtering (dev only; production filters upstream) ─────────────────
    const visibleLines = React.useMemo(
        () => (source === "dev" ? filterLines(current.lines, search) : current.lines),
        [source, current.lines, search]
    );

    // ── Scrolling ─────────────────────────────────────────────────────────
    function handleScroll() {
        const element = scrollRef.current;
        if (!element) return;
        const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
        const bottom = distance < BOTTOM_THRESHOLD_PX;
        atBottomRef.current = bottom;
        setAtBottom(bottom);
        if (bottom) setHasNew(false);
    }

    function jumpToBottom() {
        const element = scrollRef.current;
        if (!element) return;
        element.scrollTop = element.scrollHeight;
        atBottomRef.current = true;
        setAtBottom(true);
        setHasNew(false);
    }

    React.useEffect(() => {
        if (atBottomRef.current) jumpToBottom();
    }, [current.lines, source]);

    const text = React.useMemo(() => linesToText(visibleLines), [visibleLines]);
    const hasLogs = current.lines.length > 0;

    function download() {
        try {
            const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${projectId}-${source}-logs.txt`;
            link.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error(t("common.unexpectedError"));
        }
    }

    /**
     * "6 h" / "24 h" / "3 days" — one duration label for the select's options and
     * for every sentence that names the window.
     *
     * ⚠️ DAYS ONLY ABOVE A DAY. Switching at `>= 24` renders the 24-hour default as
     * "1 days", which is both wrong and the option users pick most.
     */
    const formatRange = React.useCallback(
        (hours: number) =>
            hours > 24 && hours % 24 === 0
                ? t("workspace.logs.rangeDays", { count: hours / 24 })
                : t("workspace.logs.rangeHours", { count: hours }),
        [t]
    );

    const rangeLabel = formatRange(rangeHours);

    /** "Updated 2 minutes ago" — the answer to "is this stale?". */
    const updatedLabel = current.updatedAt
        ? t("workspace.logs.updated", { when: formatRelativeDate(new Date(current.updatedAt), locale) })
        : null;

    return (
        <div className="bg-card flex h-full min-h-0 flex-col">
            {/* ═══ SOURCE SWITCH ═════════════════════════════════════ */}
            <div className="border-border/60 flex flex-wrap items-center gap-2 border-b px-2 py-1.5">
                <div
                    role="tablist"
                    aria-label={t("workspace.logs.sourceLabel")}
                    className="bg-muted flex shrink-0 gap-0.5 rounded-lg p-0.5"
                >
                    {SOURCES.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={source === item.id}
                            onClick={() => selectSource(item.id)}
                            className={cn(
                                "focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                                source === item.id
                                    ? "bg-card text-foreground shadow-2xs"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <item.icon className="size-3.5" aria-hidden />
                            {t(item.labelKey)}
                        </button>
                    ))}
                </div>

                {/* The one line that answers "am I looking at the right machine?" */}
                <p className="text-muted-foreground min-w-0 flex-1 truncate text-[11px]">
                    {source === "dev"
                        ? t("workspace.logs.devHint")
                        : t("workspace.logs.prodHint", { range: rangeLabel })}
                </p>

                {updatedLabel && (
                    <span
                        className="text-muted-foreground shrink-0 text-[11px] tabular-nums"
                        aria-live="polite"
                    >
                        {updatedLabel}
                    </span>
                )}
            </div>

            {/* ═══ TOOLBAR ═══════════════════════════════════════════ */}
            <div className="border-border/60 flex flex-wrap items-center gap-2 border-b p-2">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                    <SearchIcon
                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2"
                        aria-hidden
                    />
                    <Input
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === "Escape") setSearch("");
                        }}
                        placeholder={t(
                            source === "prod"
                                ? "workspace.logs.searchProdPlaceholder"
                                : "workspace.logs.searchPlaceholder"
                        )}
                        aria-label={t(
                            source === "prod"
                                ? "workspace.logs.searchProdPlaceholder"
                                : "workspace.logs.searchPlaceholder"
                        )}
                        aria-describedby={source === "prod" ? "logs-search-hint" : undefined}
                        disabled={source === "dev" && !hasLogs}
                        className="h-7 pr-6 pl-7 text-xs"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            aria-label={t("pages.projects.searchClear")}
                            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1 -translate-y-1/2 rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
                        >
                            <XIcon className="size-3" aria-hidden />
                        </button>
                    )}
                </div>

                {/*
                  * ⚠️ PRODUCTION ONLY, AND NOT OPTIONAL. The window it sets is the
                  * difference between seeing your traffic and being told there is
                  * none — the worker's own default is six hours.
                  */}
                {source === "prod" && (
                    <Select
                        value={String(rangeHours)}
                        onValueChange={value => setRangeHours(Number(value) as ProdRangeHours)}
                    >
                        <SelectTrigger
                            size="sm"
                            className="h-7 w-auto shrink-0 text-xs"
                            aria-label={t("workspace.logs.rangeLabel")}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PROD_RANGE_HOURS.map(hours => (
                                <SelectItem key={hours} value={String(hours)} className="text-xs">
                                    {formatRange(hours)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                <div className="flex items-center gap-1.5">
                    <Switch
                        id="logs-auto-refresh"
                        checked={autoRefresh}
                        onCheckedChange={setAutoRefresh}
                        aria-describedby="logs-auto-refresh-hint"
                    />
                    <Label
                        htmlFor="logs-auto-refresh"
                        className="text-muted-foreground text-xs whitespace-nowrap"
                    >
                        {t("workspace.logs.autoRefresh")}
                    </Label>
                    <span id="logs-auto-refresh-hint" className="sr-only">
                        {t(
                            source === "prod"
                                ? "workspace.logs.autoRefreshHintProd"
                                : "workspace.logs.autoRefreshHint"
                        )}
                    </span>
                </div>

                <div className="ml-auto flex items-center gap-0.5">
                    <CopyButton value={text} size="icon" disabled={!hasLogs} />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={download}
                        disabled={!hasLogs}
                        aria-label={t("workspace.logs.download")}
                        title={t("workspace.logs.download")}
                    >
                        <DownloadIcon className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => void refresh()}
                        disabled={loading}
                        aria-label={t("workspace.logs.refresh")}
                        title={t("workspace.logs.refresh")}
                    >
                        <RefreshCwIcon
                            className={cn("size-3.5", loading && "animate-spin")}
                            aria-hidden
                        />
                    </Button>
                </div>

                {source === "prod" && (
                    <p id="logs-search-hint" className="text-muted-foreground w-full text-[11px]">
                        {t("workspace.logs.prodSearchHint", { range: rangeLabel })}
                    </p>
                )}
            </div>

            {/* ═══ BODY ══════════════════════════════════════════════ */}
            <div className="relative min-h-0 flex-1">
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="tp-scroll bg-surface-sunken h-full overflow-auto p-3"
                >
                    {!current.fetched && !loading && (
                        <div className="grid h-full min-w-0 place-items-center px-1">
                            <EmptyState
                                variant="panel"
                                className="w-full min-w-0"
                                icon={source === "prod" ? <CloudIcon /> : <TerminalIcon />}
                                title={t("workspace.logs.title")}
                                description={t(
                                    source === "prod"
                                        ? "workspace.logs.introProdDescription"
                                        : "workspace.logs.introDescription"
                                )}
                                actions={
                                    <Button
                                        size="sm"
                                        onClick={() => void refresh()}
                                        disabled={loading}
                                    >
                                        <TerminalIcon className="size-4" aria-hidden />
                                        {t("workspace.logs.load")}
                                    </Button>
                                }
                            />
                        </div>
                    )}

                    {loading && !current.fetched && (
                        <div className="grid h-full min-w-0 place-items-center px-1">
                            <LoaderIcon className="text-muted-foreground size-5 animate-spin" aria-hidden />
                        </div>
                    )}

                    {current.fetched && current.error && (
                        <div className="grid h-full min-w-0 place-items-center px-1">
                            <ErrorState
                                variant="panel"
                                className="w-full min-w-0"
                                title={t(
                                    current.errorCode === "RATE_LIMITED"
                                        ? "workspace.logs.rateLimitedTitle"
                                        : "workspace.logs.fetchFailed"
                                )}
                                description={t(
                                    current.errorCode === "RATE_LIMITED"
                                        ? "workspace.logs.rateLimitedDescription"
                                        : source === "prod"
                                          ? "workspace.logs.fetchFailedProdDescription"
                                          : "workspace.logs.fetchFailedDescription"
                                )}
                                detail={current.error}
                                onRetry={() => void refresh()}
                            />
                        </div>
                    )}

                    {current.fetched && !current.error && !hasLogs && (
                        <div className="grid h-full min-w-0 place-items-center px-1">
                            <EmptyState
                                variant="panel"
                                className="w-full min-w-0"
                                icon={source === "prod" ? <RocketIcon /> : <TerminalIcon />}
                                title={t(
                                    source === "prod"
                                        ? hasBeenDeployed === false
                                            ? "workspace.logs.notDeployedTitle"
                                            : "workspace.logs.emptyProdTitle"
                                        : "workspace.logs.emptyTitle"
                                )}
                                description={t(
                                    source === "prod"
                                        ? hasBeenDeployed === false
                                            ? "workspace.logs.notDeployedDescription"
                                            : search
                                              ? "workspace.logs.emptyProdSearchDescription"
                                              : "workspace.logs.emptyProdDescription"
                                        : "workspace.logs.emptyDescription",
                                    // Only the production strings interpolate it; the
                                    // dev ones simply ignore the extra value.
                                    { range: rangeLabel }
                                )}
                            />
                        </div>
                    )}

                    {current.fetched && !current.error && hasLogs && (
                        <>
                            {source === "dev" && search && visibleLines.length === 0 ? (
                                <p className="text-muted-foreground p-4 text-center text-xs">
                                    {t("workspace.logs.noMatches", { query: search })}
                                </p>
                            ) : (
                                <>
                                    {source === "dev" && search && (
                                        <p className="text-muted-foreground mb-2 text-[11px]">
                                            {t("workspace.logs.matchCount", {
                                                count: visibleLines.length,
                                                total: current.lines.length,
                                            })}
                                        </p>
                                    )}
                                    <pre className="font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">
                                        {visibleLines.map((line, index) => (
                                            <div
                                                key={index}
                                                className={cn(
                                                    LEVEL_CLASS[line.level],
                                                    line.heading && "mt-1.5 font-medium first:mt-0"
                                                )}
                                            >
                                                {line.text || " "}
                                            </div>
                                        ))}
                                    </pre>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* The jump-to-bottom pill — only when it is actually useful. */}
                {current.fetched && hasLogs && !atBottom && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                        <Button
                            size="sm"
                            onClick={jumpToBottom}
                            className="pointer-events-auto gap-1.5 rounded-full shadow-lg"
                        >
                            <ArrowDownIcon className="size-3.5" aria-hidden />
                            {hasNew ? t("workspace.logs.newEntries") : t("workspace.logs.jumpToBottom")}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
