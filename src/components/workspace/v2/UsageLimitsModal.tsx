"use client";

import * as React from "react";
import { GaugeIcon, SparklesIcon, WalletIcon } from "lucide-react";
import { Modal, SpinnerBlock, StatusPill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useLocale, useT } from "@/i18n";
import { formatDate, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { colorForType } from "@/lib/usage";
import { vcaasApi } from "@/lib/vcaas";
import {
    FEATURE_KEYS,
    type FeatureKey,
    type FeatureLimit,
    type ProjectCreditLimits,
    type ProjectLimits,
    type V2Usage,
} from "@/lib/vcaas-types";
import { capError, capValue, devBudgetError, isEditableFeature, usageRows, usageTotal } from "@/lib/v2-usage";
import { budgetState, formatCreditAmount, nextMonthStart, usageByGroup } from "@/lib/v2-pages";
import { Callout, Card, Disclosure, Segmented } from "./page-bits";

type Env = "all" | "live" | "dev";
type Period = "month" | "day";
type Draft = Record<FeatureKey, { enabled: boolean; credits: string; units: string }>;

const toText = (value: number | null | undefined) => (typeof value === "number" ? String(value) : "");
/** Always on: the app cannot run without them (SDK-API refuses `FEATURE_NOT_DISABLABLE`). */
const ALWAYS_ON: FeatureKey[] = ["database", "worker"];

function draftOf(limits: ProjectLimits): Draft {
    return Object.fromEntries(
        FEATURE_KEYS.map(key => {
            const limit = limits.features?.[key];
            return [
                key,
                {
                    enabled: limit?.enabled ?? true,
                    credits: toText(limit?.monthlyCreditCap),
                    units: toText(limit?.monthlyUnitCap),
                },
            ];
        }),
    ) as Draft;
}

/**
 * "Usage & limits" of a v2 project (A6.21, A6.34, A6.45; plan 15 §4.10, §4.24). Credits only. The numbers are the
 * fields of `GET …/usage` / `GET …/limits`: the chart groups the server's per-dimension credits, the total is the
 * server's own. A limit or an off switch stops one feature until the month resets — never the project.
 */
export function UsageLimitsModal({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (open: boolean) => void; projectId: string }) {
    const t = useT();
    const { locale } = useLocale();
    const [env, setEnv] = React.useState<Env>("all");
    const [period, setPeriod] = React.useState<Period>("month");
    const [usage, setUsage] = React.useState<V2Usage | null | undefined>(undefined);
    const [limits, setLimits] = React.useState<ProjectLimits | null>(null);
    const [draft, setDraft] = React.useState<Draft | null>(null);
    const [saved, setSaved] = React.useState<Draft | null>(null);
    const [saving, setSaving] = React.useState(false);
    // abud: the monthly development budget (`creditLimits.maxDevelopmentCreditsPerMonth`, PATCH …/credit-limits)
    const [credit, setCredit] = React.useState<ProjectCreditLimits | null>(null);
    const [devDraft, setDevDraft] = React.useState("");

    React.useEffect(() => {
        if (!open) return;
        setUsage(undefined);
        void vcaasApi.v2.usage(projectId, { env, groupBy: period }).then(response => setUsage(response.ok ? response.data : null));
    }, [open, projectId, env, period]);

    const loadLimits = React.useCallback(async () => {
        const [response, creditResponse] = await Promise.all([vcaasApi.v2.limits(projectId), vcaasApi.v2.creditLimits(projectId)]);
        const creditData = creditResponse.ok ? creditResponse.data : null;
        setCredit(creditData);
        setDevDraft(toText(creditData?.creditLimits.maxDevelopmentCreditsPerMonth));
        const data = response.ok ? response.data : null;
        setLimits(data);
        if (data) {
            const next = draftOf(data);
            setDraft(next);
            setSaved(next);
        }
    }, [projectId]);

    React.useEffect(() => {
        if (open) void loadLimits();
    }, [open, loadLimits]);

    const shown = FEATURE_KEYS.filter(key => limits?.features?.[key] && key !== "all");
    /** In use = spent something, switched off or given a limit: shown first; the rest is folded away. */
    const inUse = shown.filter(key => {
        const limit = limits?.features?.[key];
        return (
            (limit?.consumed?.credits ?? 0) > 0 ||
            limit?.enabled === false ||
            typeof limit?.monthlyCreditCap === "number" ||
            (saved && (!saved[key].enabled || saved[key].credits !== ""))
        );
    });
    const idle = shown.filter(key => !inUse.includes(key));
    const errors = draft
        ? FEATURE_KEYS.filter(key => {
              const ceiling = limits?.features?.[key]?.planCeiling;
              return capError(draft[key].credits, ceiling?.monthlyCreditCap) || capError(draft[key].units, ceiling?.monthlyUnitCap);
          })
        : [];
    const devError = devBudgetError(devDraft);
    const devDirty = !!credit && devDraft !== toText(credit.creditLimits.maxDevelopmentCreditsPerMonth);
    const featuresDirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
    const dirty = featuresDirty || devDirty;

    const save = async () => {
        if (!draft || errors.length || devError) return;
        setSaving(true);
        if (devDirty) {
            const devResponse = await vcaasApi.v2.setCreditLimits(projectId, { maxDevelopmentCreditsPerMonth: capValue(devDraft) });
            if (!devResponse.ok) {
                setSaving(false);
                toast.error(devResponse.error || t("engineV2.common.failed"));
                return;
            }
            if (!featuresDirty) {
                setSaving(false);
                toast.success(t("engineV2.limits.saved"));
                void loadLimits();
                return;
            }
        }
        const features = Object.fromEntries(
            FEATURE_KEYS.filter(key => limits?.features?.[key] && isEditableFeature(limits.features[key])).map(key => [
                key,
                {
                    enabled: draft[key].enabled,
                    monthlyCreditCap: capValue(draft[key].credits),
                    monthlyUnitCap: key === "all" ? null : capValue(draft[key].units),
                },
            ]),
        );
        const response = await vcaasApi.v2.setLimits(projectId, features);
        setSaving(false);
        if (response.ok) {
            toast.success(t("engineV2.limits.saved"));
            void loadLimits();
        } else toast.error(response.error || t("engineV2.common.failed"));
    };

    const set = (key: FeatureKey, patch: Partial<Draft[FeatureKey]>) =>
        setDraft(current => (current ? { ...current, [key]: { ...current[key], ...patch } } : current));

    const total = usageTotal(usage);
    const groups = usageByGroup(usage);
    const biggest = groups[0]?.credits ?? 0;
    const resetDate = formatDate(nextMonthStart(), locale);
    const all = limits?.features?.all;

    /** A render function, not a component: a component defined here would remount on every keystroke. */
    const featureList = (keys: FeatureKey[]) =>
        !draft ? null : (
            <ul className="divide-border divide-y">
                {keys.map(key => {
                    const limit = limits?.features?.[key] as FeatureLimit;
                    const editable = isEditableFeature(limit);
                    const alwaysOn = ALWAYS_ON.includes(key);
                    const error = capError(draft[key].credits, limit.planCeiling?.monthlyCreditCap);
                    const used = limit.consumed?.credits ?? 0;
                    const state = budgetState(used, capValue(draft[key].credits));
                    return (
                        <li key={key} className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${limit.parent ? "pl-5" : ""}`} data-feature={key}>
                            <div className="min-w-0 flex-1 basis-56">
                                <p className="text-sm font-medium">
                                    {t(`engineV2.limits.name_${key}`)}
                                    {!draft[key].enabled ? (
                                        <StatusPill tone="neutral" className="ml-2 align-middle">
                                            {t("engineV2.limits.off")}
                                        </StatusPill>
                                    ) : state?.level === "reached" ? (
                                        <StatusPill tone="danger" className="ml-2 align-middle">
                                            {t("engineV2.limits.reached")}
                                        </StatusPill>
                                    ) : state?.level === "warn" ? (
                                        <StatusPill tone="warning" className="ml-2 align-middle">
                                            {t("engineV2.limits.almost", { percent: state.percent })}
                                        </StatusPill>
                                    ) : null}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    {t(`engineV2.limits.desc_${key}`)}
                                    {limit.source === "ceo" ? ` · ${t("engineV2.limits.setBySupport")}` : ""}
                                </p>
                                <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                                    {t("engineV2.limits.usedCredits", {
                                        credits: formatCreditAmount(used, locale),
                                    })}
                                </p>
                            </div>
                            <label className="flex flex-col gap-1 text-xs">
                                <span className="text-muted-foreground">{t("engineV2.limits.creditCap")}</span>
                                <Input
                                    inputMode="numeric"
                                    className="h-8 w-32"
                                    disabled={!editable || !draft[key].enabled}
                                    value={draft[key].credits}
                                    aria-invalid={!!error}
                                    placeholder={t("engineV2.limits.noLimit")}
                                    onChange={event => set(key, { credits: event.target.value })}
                                />
                                {error ? <span className="text-destructive">{t(`engineV2.limits.error_${error}`)}</span> : null}
                            </label>
                            <label className="flex flex-col items-center gap-1 text-xs" title={alwaysOn ? t("engineV2.limits.alwaysOn") : undefined}>
                                <span className="text-muted-foreground">{draft[key].enabled ? t("engineV2.limits.on") : t("engineV2.limits.off")}</span>
                                <Switch
                                    checked={draft[key].enabled}
                                    disabled={!editable || alwaysOn}
                                    aria-label={t("engineV2.limits.toggle", {
                                        feature: t(`engineV2.limits.name_${key}`),
                                    })}
                                    onCheckedChange={enabled => set(key, { enabled })}
                                />
                            </label>
                        </li>
                    );
                })}
            </ul>
        );

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            title={t("engineV2.usage.title")}
            description={t("engineV2.usage.intro")}
            footer={
                dirty ? (
                    <div className="flex w-full flex-wrap items-center justify-end gap-3">
                        <span className="text-muted-foreground text-xs">{t("engineV2.limits.unsaved")}</span>
                        <Button
                            variant="outline"
                            disabled={saving}
                            onClick={() => {
                                if (saved) setDraft(saved);
                                setDevDraft(toText(credit?.creditLimits.maxDevelopmentCreditsPerMonth));
                            }}
                        >
                            {t("engineV2.limits.discard")}
                        </Button>
                        <Button disabled={saving || errors.length > 0 || !!devError} onClick={() => void save()}>
                            {saving ? t("common.saving") : t("engineV2.limits.saveLimits")}
                        </Button>
                    </div>
                ) : undefined
            }
        >
            <div className="space-y-6">
                {/* ── What was spent ─────────────────────────────────────── */}
                <section className="space-y-3" aria-labelledby="usage-spent">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 id="usage-spent" className="text-base font-semibold">
                            {t("engineV2.usage.spentTitle")}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            <Segmented<Period>
                                label={t("engineV2.usage.periodLabel")}
                                value={period}
                                onChange={setPeriod}
                                options={[
                                    { value: "month", label: t("engineV2.usage.thisMonth") },
                                    { value: "day", label: t("engineV2.usage.today") },
                                ]}
                            />
                            <Segmented<Env>
                                label={t("engineV2.usage.envLabel")}
                                value={env}
                                onChange={setEnv}
                                options={(["all", "live", "dev"] as const).map(value => ({
                                    value,
                                    label: t(`engineV2.usage.env_${value}`),
                                }))}
                            />
                        </div>
                    </div>

                    {usage === undefined ? (
                        <SpinnerBlock />
                    ) : usage === null ? (
                        <p className="text-muted-foreground text-sm">{t("engineV2.common.unavailable")}</p>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-[minmax(0,14rem)_1fr]">
                            <Card className="flex flex-col justify-center" testId="usage-total">
                                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                                    {t(period === "month" ? "engineV2.usage.usedThisMonth" : "engineV2.usage.usedToday")}
                                </p>
                                <p className="font-display text-3xl font-semibold tabular-nums">
                                    {formatCreditAmount(total, locale)}{" "}
                                    <span className="text-muted-foreground text-base font-normal">{t("engineV2.usage.creditsUnit")}</span>
                                </p>
                                <p className="text-muted-foreground text-xs">{t(`engineV2.usage.envNote_${env}`)}</p>
                            </Card>
                            <Card title={t("engineV2.usage.byFeatureTitle")} testId="usage-by-feature">
                                {groups.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">{t("engineV2.usage.nothingYet")}</p>
                                ) : (
                                    <ul className="space-y-2.5">
                                        {groups.map(({ group, credits }) => (
                                            <li key={group} className="text-sm">
                                                <div className="flex items-baseline justify-between gap-3">
                                                    <span className="min-w-0 truncate">{t(`engineV2.usage.group_${group}`)}</span>
                                                    <span className="shrink-0 tabular-nums">
                                                        {formatCreditAmount(credits, locale)}{" "}
                                                        <span className="text-muted-foreground text-xs">{t("engineV2.usage.creditsUnit")}</span>
                                                    </span>
                                                </div>
                                                <div className="bg-muted mt-1 h-2 overflow-hidden rounded-full" aria-hidden>
                                                    <div
                                                        className="h-full rounded-full"
                                                        style={{
                                                            width: `${Math.max(2, (credits / (biggest || 1)) * 100)}%`,
                                                            background: colorForType(group),
                                                        }}
                                                    />
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>
                        </div>
                    )}

                    {usage ? (
                        <Disclosure title={t("engineV2.usage.detailsTitle")} hint={t("engineV2.usage.detailsHint")}>
                            <table className="w-full text-sm">
                                <thead className="text-muted-foreground text-left text-xs">
                                    <tr>
                                        <th className="py-1 font-medium">{t("engineV2.usage.dimension")}</th>
                                        <th className="py-1 text-right font-medium">{t("engineV2.usage.units")}</th>
                                        <th className="py-1 text-right font-medium">{t("engineV2.usage.credits")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usageRows(usage).map(row => (
                                        <tr key={row.dimension} className="border-border border-t">
                                            <td className="py-1.5 font-mono text-xs">{row.dimension}</td>
                                            <td className="py-1.5 text-right text-xs tabular-nums">
                                                {row.units ?? "—"} {row.unit ?? ""}
                                            </td>
                                            <td className="py-1.5 text-right tabular-nums">{row.credits ?? "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-border border-t font-medium">
                                        <td className="py-1.5">{t("engineV2.usage.total")}</td>
                                        <td />
                                        <td className="py-1.5 text-right tabular-nums">{total ?? "—"}</td>
                                    </tr>
                                </tfoot>
                            </table>
                            <p className="text-muted-foreground text-xs">{t("engineV2.usage.sameAsApi")}</p>
                        </Disclosure>
                    ) : null}
                </section>

                {/* ── Limits ────────────────────────────────────────────── */}
                <section className="space-y-3" aria-labelledby="usage-limits">
                    <h3 id="usage-limits" className="text-base font-semibold">
                        {t("engineV2.limits.title")}
                    </h3>
                    <Callout title={t("engineV2.limits.howTitle")}>{t("engineV2.limits.howBody", { date: resetDate })}</Callout>

                    {!draft ? (
                        <SpinnerBlock />
                    ) : (
                        <>
                            {credit ? (
                                <BudgetCard
                                    title={t("engineV2.limits.devBudgetTitle")}
                                    hint={t("engineV2.limits.devBudgetHint")}
                                    icon={<SparklesIcon />}
                                    testId="project-dev-budget"
                                    used={credit.usedThisMonth?.development ?? null}
                                    value={devDraft}
                                    editable
                                    error={devError}
                                    onChange={setDevDraft}
                                />
                            ) : null}
                            {all ? (
                                <BudgetCard
                                    title={t("engineV2.limits.budgetTitle")}
                                    hint={t("engineV2.limits.budgetHint")}
                                    icon={<WalletIcon />}
                                    testId="project-budget"
                                    used={all.consumed?.credits ?? 0}
                                    value={draft.all.credits}
                                    editable={isEditableFeature(all)}
                                    error={capError(draft.all.credits, all.planCeiling?.monthlyCreditCap)}
                                    onChange={credits => set("all", { credits })}
                                />
                            ) : null}

                            <Card
                                title={t("engineV2.limits.featuresTitle")}
                                description={t("engineV2.limits.featuresHint")}
                                icon={<GaugeIcon />}
                                testId="feature-limits"
                            >
                                {inUse.length === 0 ? <p className="text-muted-foreground text-xs">{t("engineV2.limits.noneInUse")}</p> : null}
                                {featureList(inUse)}
                                {idle.length ? (
                                    <Disclosure
                                        title={t("engineV2.limits.moreFeatures", {
                                            count: idle.length,
                                        })}
                                        hint={t("engineV2.limits.moreFeaturesHint")}
                                        testId="more-features"
                                    >
                                        {featureList(idle)}
                                    </Disclosure>
                                ) : null}
                            </Card>

                            <Disclosure title={t("engineV2.limits.advancedTitle")} hint={t("engineV2.limits.advancedHint")} testId="limits-advanced">
                                <table className="w-full text-sm">
                                    <thead className="text-muted-foreground text-left text-xs">
                                        <tr>
                                            <th className="py-1 font-medium">{t("engineV2.limits.feature")}</th>
                                            <th className="py-1 font-medium">{t("engineV2.limits.unitCap")}</th>
                                            <th className="py-1 font-medium">{t("engineV2.limits.used")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shown.map(key => {
                                            const limit = limits?.features?.[key] as FeatureLimit;
                                            const max = limit.planCeiling?.monthlyUnitCap;
                                            const error = capError(draft[key].units, max);
                                            return (
                                                <tr key={key} className="border-border border-t align-top">
                                                    <td className="py-2 pr-2">
                                                        {t(`engineV2.limits.name_${key}`)}
                                                    </td>
                                                    <td className="py-2 pr-2">
                                                        <Input
                                                            inputMode="numeric"
                                                            className="h-8 w-32"
                                                            disabled={!isEditableFeature(limit)}
                                                            value={draft[key].units}
                                                            aria-invalid={!!error}
                                                            aria-label={`${t(`engineV2.limits.name_${key}`)} · ${t("engineV2.limits.unitCap")}`}
                                                            placeholder={
                                                                typeof max === "number" ? t("engineV2.limits.max", { max }) : t("engineV2.limits.noLimit")
                                                            }
                                                            onChange={event => set(key, { units: event.target.value })}
                                                        />
                                                        {error ? <p className="text-destructive text-xs">{t(`engineV2.limits.error_${error}`)}</p> : null}
                                                    </td>
                                                    <td className="text-muted-foreground py-2 text-xs tabular-nums">
                                                        {limit.consumed ? `${limit.consumed.units} ${limit.unit ?? ""}` : "—"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </Disclosure>
                        </>
                    )}

                    <div className="space-y-1" data-testid="refusals">
                        <h4 className="text-sm font-medium">{t("engineV2.limits.refusedTitle")}</h4>
                        {usage?.refusals?.length ? (
                            <ul className="space-y-1 text-xs">
                                {usage.refusals.map((refusal, index) => (
                                    <li key={index}>
                                        {formatDateTime(refusal.at, locale)} —{" "}
                                        {(FEATURE_KEYS as readonly string[]).includes(refusal.feature)
                                            ? t(`engineV2.limits.name_${refusal.feature as FeatureKey}`)
                                            : refusal.feature}
                                        : {t(refusal.code === "FEATURE_DISABLED" ? "engineV2.limits.refusedDisabled" : "engineV2.limits.refusedCap")}
                                        {refusal.count && refusal.count > 1 ? ` ×${refusal.count}` : ""}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground text-xs">{t("engineV2.limits.refusedNone")}</p>
                        )}
                    </div>
                </section>
            </div>
        </Modal>
    );
}

/**
 * A project's monthly credit budget: the development one (`creditLimits`, building with AI) or the `all` one (the app's
 * features = `maxInfrastructureCreditsPerMonth`): what it covers, how full it is, and what happens at 100 %.
 */
function BudgetCard({
    title,
    hint,
    icon,
    testId,
    used: usedOrNull,
    value,
    editable,
    error,
    onChange,
}: {
    title: string;
    hint: string;
    icon: React.ReactNode;
    testId: string;
    /** `null` when this month's spend could not be read. */
    used: number | null;
    value: string;
    editable: boolean;
    error: "notANumber" | "aboveCeiling" | "notPositive" | null;
    onChange: (credits: string) => void;
}) {
    const t = useT();
    const { locale } = useLocale();
    const used = usedOrNull ?? 0;
    const cap = capValue(value);
    const state = usedOrNull === null ? null : budgetState(used, cap);
    return (
        <Card title={title} description={hint} icon={icon} testId={testId}>
            <div className="flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">{t("engineV2.limits.budgetLabel")}</span>
                    <Input
                        inputMode="numeric"
                        className="h-9 w-40"
                        disabled={!editable}
                        value={value}
                        aria-invalid={!!error}
                        placeholder={t("engineV2.limits.noLimit")}
                        onChange={event => onChange(event.target.value)}
                    />
                    {error ? <span className="text-destructive">{t(`engineV2.limits.error_${error}`)}</span> : null}
                </label>
                <div className="min-w-0 flex-1 basis-48 space-y-1 text-xs">
                    <p className="tabular-nums">
                        {usedOrNull === null
                            ? t("engineV2.common.unavailable")
                            : cap === null
                              ? t("engineV2.limits.budgetNoCap", {
                                    used: formatCreditAmount(used, locale),
                                })
                              : t("engineV2.limits.budgetOf", {
                                    used: formatCreditAmount(used, locale),
                                    cap: formatCreditAmount(cap, locale),
                                })}
                    </p>
                    {state ? (
                        <div
                            className="bg-muted h-2 overflow-hidden rounded-full"
                            role="progressbar"
                            aria-valuenow={state.percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div
                                className={`h-full rounded-full ${state.level === "reached" ? "bg-destructive" : state.level === "warn" ? "bg-warning" : "bg-primary"}`}
                                style={{ width: `${Math.max(2, state.percent)}%` }}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
            {!editable ? <p className="text-muted-foreground text-xs">{t("engineV2.limits.setBySupport")}</p> : null}
        </Card>
    );
}
