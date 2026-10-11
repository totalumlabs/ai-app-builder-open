"use client";

import * as React from "react";
import { CalendarClockIcon, HistoryIcon, PlayIcon, PlusIcon, RocketIcon, Trash2Icon } from "lucide-react";
import { ConfirmDialog, EmptyState, Modal, SpinnerBlock, StatusPill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useLocale, useT } from "@/i18n";
import { formatDateTimeZoned, formatRelativeDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import type { CronJob, CronRun } from "@/lib/vcaas-types";
import { DEFAULT_CRON_FORM, buildCron, pauseChoices, describeSchedule, failurePolicy, runOutcome, type CronForm, type CronFrequency } from "@/lib/v2-pages";
import { Callout, Card, Disclosure } from "./page-bits";

const FREQUENCIES: CronFrequency[] = ["minutes", "hourly", "daily", "weekdays", "weekly", "monthly", "custom"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const SELECT = "border-input bg-background h-9 w-full rounded-md border px-2 text-sm";
const OUTCOME_TONE = { ok: "success", failed: "danger", skipped: "neutral" } as const;

/** The viewer's zone: a UTC schedule's time is also given in it; a new task runs in it by default (cron2). */
const browserZone = () => ({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });

/** cron2: the failure setting as a `<select>` value (`never` = `null`). */
const pauseValue = (n: number | null | undefined) => (n === null ? "never" : String(n ?? 3));
const pauseParse = (v: string) => (v === "never" ? null : Number(v));

function PauseSelect({ value, onChange, label }: { value: number | null | undefined; onChange: (n: number | null) => void; label: string }) {
    const t = useT();
    return (
        <select className={SELECT} aria-label={label} value={pauseValue(value)} onChange={e => onChange(pauseParse(e.target.value))}>
            {pauseChoices(value).map(n => (
                <option key={String(n)} value={pauseValue(n)}>
                    {failurePolicy(n, t)}
                </option>
            ))}
        </select>
    );
}

/** `https://host/` of the published app, so a new task only needs its path. */
const baseOf = (liveHost?: string | null) => (liveHost ? `https://${liveHost.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : "");

/**
 * Cron jobs of a v2 project (A6.12, plan 15 §4.5): the published app called on a schedule. The schedule is picked in
 * words, in the viewer's time zone (or UTC), and stored as a cron expression plus its `timezone` (cron2: the scheduler
 * keeps it at that local time through clock changes); the list reads it back in words. The server enforces the URL
 * rule (SSRF guard), the plan's job count and interval floor, and pauses a job after its `pauseAfterFailures` failed
 * runs in a row (default 3, or never), which each row lets the owner change; the UI shows its messages.
 */
export function CronJobsModal({
    open,
    onOpenChange,
    projectId,
    published,
    liveHost,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    published: boolean;
    /** `productionProjectUrl` (host, custom domain when active): new tasks call this site. */
    liveHost?: string | null;
}) {
    const t = useT();
    const [jobs, setJobs] = React.useState<CronJob[] | null>(null);
    const [adding, setAdding] = React.useState(false);
    const [deleting, setDeleting] = React.useState<CronJob | null>(null);

    const load = React.useCallback(async () => {
        const response = await vcaasApi.v2.cronJobs(projectId);
        setJobs(response.ok ? (response.data?.items ?? []) : []);
    }, [projectId]);

    React.useEffect(() => {
        if (open && published) void load();
        if (!open) setAdding(false);
    }, [open, published, load]);

    const act = async (call: Promise<{ ok: boolean; error?: string }>, success?: string) => {
        const response = await call;
        if (response.ok) {
            if (success) toast.success(success);
        } else toast.error(response.error || t("engineV2.common.failed"));
        void load();
        return response.ok;
    };

    return (
        <Modal open={open} onOpenChange={onOpenChange} size="lg" title={t("engineV2.cron.title")} description={t("engineV2.cron.intro")}>
            {!published ? (
                <EmptyState variant="panel" icon={<RocketIcon />} title={t("engineV2.cron.publishFirstTitle")} description={t("engineV2.cron.publishFirst")} />
            ) : jobs === null ? (
                <SpinnerBlock />
            ) : (
                <div className="space-y-4">
                    {jobs.length === 0 && !adding ? (
                        <EmptyState
                            variant="panel"
                            icon={<CalendarClockIcon />}
                            title={t("engineV2.cron.emptyTitle")}
                            description={t("engineV2.cron.emptyBody")}
                            actions={
                                <Button onClick={() => setAdding(true)}>
                                    <PlusIcon className="size-4" aria-hidden />
                                    {t("engineV2.cron.add")}
                                </Button>
                            }
                        />
                    ) : (
                        <>
                            <ul className="space-y-2" aria-label={t("engineV2.cron.listLabel")}>
                                {jobs.map(job => (
                                    <JobRow
                                        key={job.id}
                                        job={job}
                                        projectId={projectId}
                                        onToggle={enabled => void act(vcaasApi.v2.updateCronJob(projectId, job.id, { enabled }), t(enabled ? "engineV2.cron.turnedOn" : "engineV2.cron.turnedOff"))}
                                        onPauseAfter={pauseAfterFailures => void act(vcaasApi.v2.updateCronJob(projectId, job.id, { pauseAfterFailures }), t("engineV2.cron.failuresSaved"))}
                                        onRun={() => void act(vcaasApi.v2.runCronJob(projectId, job.id), t("engineV2.cron.started"))}
                                        onDelete={() => setDeleting(job)}
                                    />
                                ))}
                            </ul>
                            {!adding ? (
                                <Button variant="outline" onClick={() => setAdding(true)}>
                                    <PlusIcon className="size-4" aria-hidden />
                                    {t("engineV2.cron.add")}
                                </Button>
                            ) : null}
                        </>
                    )}

                    {adding ? (
                        <NewJobForm
                            base={baseOf(liveHost)}
                            onCancel={() => setAdding(false)}
                            onCreate={async body => {
                                const ok = await act(vcaasApi.v2.createCronJob(projectId, body), t("engineV2.cron.created"));
                                if (ok) setAdding(false);
                            }}
                        />
                    ) : null}

                    <p className="text-muted-foreground text-xs">{t("engineV2.cron.footnote")}</p>
                </div>
            )}
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={value => !value && setDeleting(null)}
                tone="danger"
                title={t("engineV2.cron.deleteTitle", { name: deleting?.name ?? "" })}
                description={t("engineV2.cron.deleteBody")}
                confirmLabel={t("common.delete")}
                onConfirm={async () => {
                    if (deleting) await act(vcaasApi.v2.deleteCronJob(projectId, deleting.id), t("engineV2.cron.deleted"));
                    setDeleting(null);
                }}
            />
        </Modal>
    );
}

function JobRow({
    job,
    projectId,
    onToggle,
    onPauseAfter,
    onRun,
    onDelete,
}: {
    job: CronJob;
    projectId: string;
    onToggle: (enabled: boolean) => void;
    onPauseAfter: (n: number | null) => void;
    onRun: () => void;
    onDelete: () => void;
}) {
    const t = useT();
    const { locale } = useLocale();
    const [runs, setRuns] = React.useState<CronRun[] | null | undefined>(undefined);
    const active = job.enabled && job.status === "active";
    const last = runOutcome(job.lastRun?.status);

    const loadRuns = async () => {
        const response = await vcaasApi.v2.cronJobRuns(projectId, job.id);
        setRuns(response.ok ? (response.data?.items ?? []) : null);
    };

    return (
        <li className="border-border bg-card rounded-xl border p-3" data-testid="cron-job">
            <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1 basis-60">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {job.name}
                        <StatusPill tone={job.status === "paused_failures" ? "danger" : active ? "success" : "neutral"}>
                            {t(job.status === "paused_failures" ? "engineV2.cron.status_failures" : active ? "engineV2.cron.status_active" : "engineV2.cron.status_paused")}
                        </StatusPill>
                    </p>
                    <p className="text-sm" data-testid="cron-schedule">{describeSchedule(job.schedule, t, browserZone(), job.timezone)}</p>
                    <p className="text-muted-foreground truncate font-mono text-xs" title={job.request.url}>
                        {job.request.method} {job.request.url}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                        {job.lastRun
                            ? t("engineV2.cron.lastRun", {
                                  when: formatRelativeDate(job.lastRun.at, locale),
                                  date: formatDateTimeZoned(job.lastRun.at, locale),
                                  result: t(`engineV2.cron.outcome_${last ?? "failed"}`),
                                  status: String(job.lastRun.status),
                              })
                            : t("engineV2.cron.neverRun")}
                        {active && job.nextRunAt ? ` · ${t("engineV2.cron.next", { date: formatDateTimeZoned(job.nextRunAt, locale) })}` : ""}
                    </p>
                    {job.status === "paused_failures" ? <p className="text-destructive mt-1 text-xs">{t("engineV2.cron.pausedFailures", { n: job.pauseAfterFailures ?? 3 })}</p> : null}
                    <label className="mt-2 block max-w-sm space-y-1 text-xs" data-testid="cron-failures">
                        <span className="text-muted-foreground">{t("engineV2.cron.failures")}</span>
                        <PauseSelect value={job.pauseAfterFailures} onChange={onPauseAfter} label={t("engineV2.cron.failuresFor", { name: job.name })} />
                    </label>
                </div>
                <div className="flex items-center gap-1">
                    <Switch checked={active} aria-label={t("engineV2.cron.enabledFor", { name: job.name })} onCheckedChange={onToggle} />
                    <Button size="sm" variant="ghost" onClick={onRun}>
                        <PlayIcon className="size-4" aria-hidden />
                        {t("engineV2.cron.runNow")}
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={t("engineV2.cron.deleteFor", { name: job.name })} onClick={onDelete}>
                        <Trash2Icon className="size-4" aria-hidden />
                    </Button>
                </div>
            </div>
            <details className="group mt-2" onToggle={event => (event.currentTarget.open && runs === undefined ? void loadRuns() : undefined)}>
                <summary className="text-primary inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium [&::-webkit-details-marker]:hidden">
                    <HistoryIcon className="size-3.5" aria-hidden />
                    {t("engineV2.cron.history")}
                </summary>
                <div className="mt-2">
                    {runs === undefined ? (
                        <SpinnerBlock />
                    ) : runs === null ? (
                        <p className="text-muted-foreground text-xs">{t("engineV2.common.unavailable")}</p>
                    ) : runs.length === 0 ? (
                        <p className="text-muted-foreground text-xs">{t("engineV2.cron.noRuns")}</p>
                    ) : (
                        <ul className="divide-border divide-y text-xs" data-testid="cron-runs">
                            {runs.map(run => {
                                const outcome = runOutcome(run.status) ?? "failed";
                                return (
                                    <li key={run.id} className="flex flex-wrap items-center gap-2 py-1.5">
                                        <span className="tabular-nums">{formatDateTimeZoned(run.startedAt ?? run.scheduledFor, locale)}</span>
                                        <StatusPill tone={OUTCOME_TONE[outcome]}>
                                            {t(`engineV2.cron.outcome_${outcome}`)} · {String(run.status)}
                                        </StatusPill>
                                        {typeof run.latencyMs === "number" ? <span className="text-muted-foreground tabular-nums">{run.latencyMs} ms</span> : null}
                                        {run.error ? <span className="text-destructive w-full">{run.error}</span> : null}
                                        {run.responseSnippet ? (
                                            <pre className="bg-muted w-full overflow-auto rounded p-1.5 text-[11px] whitespace-pre-wrap">{run.responseSnippet.slice(0, 400)}</pre>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </details>
        </li>
    );
}

function NewJobForm({
    base,
    onCancel,
    onCreate,
}: {
    base: string;
    onCancel: () => void;
    onCreate: (body: Pick<CronJob, "name" | "schedule" | "request" | "timezone" | "pauseAfterFailures">) => Promise<void>;
}) {
    const t = useT();
    const [name, setName] = React.useState("");
    const [form, setForm] = React.useState<CronForm>(DEFAULT_CRON_FORM);
    const [path, setPath] = React.useState("/api/cron/");
    const [method, setMethod] = React.useState<"GET" | "POST">("GET");
    const [saving, setSaving] = React.useState(false);
    const [zone, setZone] = React.useState(browserZone().timeZone);
    const [pauseAfter, setPauseAfter] = React.useState<number | null>(3);
    const schedule = buildCron(form);
    const url = base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : path;
    const valid = !!name.trim() && url.startsWith("https://") && schedule.split(" ").length === 5;
    const needsTime = form.frequency === "daily" || form.frequency === "weekdays" || form.frequency === "weekly" || form.frequency === "monthly";

    return (
        <Card title={t("engineV2.cron.newTitle")} testId="cron-new">
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs sm:col-span-2">
                    <span className="font-medium">{t("engineV2.cron.name")}</span>
                    <Input placeholder={t("engineV2.cron.namePlaceholder")} value={name} maxLength={64} onChange={e => setName(e.target.value)} />
                </label>
                <label className="space-y-1 text-xs">
                    <span className="font-medium">{t("engineV2.cron.howOften")}</span>
                    <select className={SELECT} value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as CronFrequency })}>
                        {FREQUENCIES.map(value => (
                            <option key={value} value={value}>
                                {t(`engineV2.cron.freq_${value}`)}
                            </option>
                        ))}
                    </select>
                </label>
                {form.frequency === "minutes" ? (
                    <label className="space-y-1 text-xs">
                        <span className="font-medium">{t("engineV2.cron.everyMinutes")}</span>
                        <select className={SELECT} value={form.every} onChange={e => setForm({ ...form, every: Number(e.target.value) })}>
                            {[5, 10, 15, 30].map(n => (
                                <option key={n} value={n}>
                                    {t("engineV2.cron.every.nMinutes", { n })}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : form.frequency === "hourly" ? (
                    <label className="space-y-1 text-xs">
                        <span className="font-medium">{t("engineV2.cron.minutePast")}</span>
                        <select className={SELECT} value={form.time.split(":")[1] ?? "00"} onChange={e => setForm({ ...form, time: `00:${e.target.value}` })}>
                            {["00", "15", "30", "45"].map(m => (
                                <option key={m} value={m}>
                                    :{m}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : form.frequency === "custom" ? (
                    <label className="space-y-1 text-xs">
                        <span className="font-medium">{t("engineV2.cron.expression")}</span>
                        <Input className="font-mono" placeholder="*/15 * * * *" value={form.expression} onChange={e => setForm({ ...form, expression: e.target.value })} />
                    </label>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {form.frequency === "weekly" ? (
                            <label className="space-y-1 text-xs">
                                <span className="font-medium">{t("engineV2.cron.onDay")}</span>
                                <select className={SELECT} value={form.weekday} onChange={e => setForm({ ...form, weekday: Number(e.target.value) })}>
                                    {WEEKDAYS.map((day, index) => (
                                        <option key={day} value={index}>
                                            {t(`engineV2.cron.days.${day}`)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ) : form.frequency === "monthly" ? (
                            <label className="space-y-1 text-xs">
                                <span className="font-medium">{t("engineV2.cron.dayOfMonth")}</span>
                                <select className={SELECT} value={form.day} onChange={e => setForm({ ...form, day: Number(e.target.value) })}>
                                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                                        <option key={d} value={d}>
                                            {d}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ) : null}
                        {needsTime ? (
                            <label className={`space-y-1 text-xs ${form.frequency === "daily" || form.frequency === "weekdays" ? "col-span-2" : ""}`}>
                                <span className="font-medium">{t("engineV2.cron.atTime")}</span>
                                <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value || "00:00" })} />
                            </label>
                        ) : null}
                    </div>
                )}
                <label className="space-y-1 text-xs sm:col-span-2">
                    <span className="font-medium">{t("engineV2.cron.timezone")}</span>
                    <select className={SELECT} value={zone} onChange={e => setZone(e.target.value)} data-testid="cron-timezone">
                        {browserZone().timeZone !== "UTC" ? <option value={browserZone().timeZone}>{browserZone().timeZone}</option> : null}
                        <option value="UTC">{t("engineV2.cron.timezoneUtc")}</option>
                    </select>
                </label>
                <p className="bg-muted rounded-md px-3 py-2 text-sm sm:col-span-2" data-testid="cron-preview">
                    {describeSchedule(schedule, t, browserZone(), zone)}
                </p>
                <label className="space-y-1 text-xs sm:col-span-2">
                    <span className="font-medium">{t("engineV2.cron.whatToCall")}</span>
                    <div className="flex items-center gap-2">
                        {base ? <span className="text-muted-foreground max-w-[45%] truncate font-mono text-xs">{base}</span> : null}
                        <Input className="font-mono" value={path} onChange={e => setPath(e.target.value)} placeholder={base ? "/api/cron/daily-report" : "https://…"} />
                    </div>
                    <span className="text-muted-foreground block">{t("engineV2.cron.whatToCallHint")}</span>
                </label>
            </div>
            <Disclosure title={t("engineV2.cron.advanced")} className="mt-1">
                <label className="block space-y-1 text-xs">
                    <span className="font-medium">{t("engineV2.cron.method")}</span>
                    <select className={SELECT} value={method} onChange={e => setMethod(e.target.value as "GET" | "POST")}>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                    </select>
                </label>
                <label className="block space-y-1 text-xs">
                    <span className="font-medium">{t("engineV2.cron.failures")}</span>
                    <PauseSelect value={pauseAfter} onChange={setPauseAfter} label={t("engineV2.cron.failures")} />
                </label>
                <p className="text-muted-foreground text-xs">{t("engineV2.cron.expressionIs", { expression: schedule || "—" })}</p>
            </Disclosure>
            <Callout>{t("engineV2.cron.utcNote")}</Callout>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onCancel}>
                    {t("common.cancel")}
                </Button>
                <Button
                    disabled={saving || !valid}
                    onClick={async () => {
                        setSaving(true);
                        await onCreate({
                            name: name.trim(),
                            schedule,
                            request: { method, url },
                            ...(zone !== "UTC" ? { timezone: zone } : {}),
                            ...(pauseAfter !== 3 ? { pauseAfterFailures: pauseAfter } : {}),
                        });
                        setSaving(false);
                    }}
                >
                    {saving ? t("common.saving") : t("engineV2.cron.create")}
                </Button>
            </div>
        </Card>
    );
}
