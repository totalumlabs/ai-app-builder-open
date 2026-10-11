"use client";

import * as React from "react";
import { AppleIcon, DownloadIcon, ExternalLinkIcon, LoaderIcon, LockIcon, PlayIcon, SmartphoneIcon, StoreIcon, UploadIcon, ZapIcon } from "lucide-react";
import { ConfirmDialog, EmptyState, Modal, SpinnerBlock, StatusPill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useT } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import type { MobileBuild, MobileSettings, MobileStores, OwnBuildKey, StoreUpload } from "@/lib/vcaas-types";
import { retryAtOf } from "@/lib/v2-pages";
import { Callout, Card, Disclosure } from "./page-bits";

const TONE = { queued: "neutral", running: "info", success: "success", failed: "danger", cancelled: "neutral" } as const;
const UPLOAD_TONE = {
    queued: "neutral",
    uploading: "info",
    processing: "info",
    success: "success",
    failed: "danger",
    manual_required: "warning",
} as const;
/** Only a signed release goes to a store: an aab to Google Play internal, an ipa to TestFlight. */
const storeOf = (build: MobileBuild) =>
    build.signed && build.status === "success" ? ({ aab: "googlePlay", ipa: "appStore" } as const)[build.artifact?.type ?? ""] : undefined;
const codeOf = (response: { code?: string; upstreamCode?: string }) => response.upstreamCode ?? response.code;
const readFile = (file: File | undefined) => (file ? file.text() : Promise.resolve(""));

/**
 * The Mobile panel of a v2 project (A7.10, A7.10b, plan 15 §4.12). On/off is the project's `mobile` feature switch
 * (the same one Usage & limits shows). Builds: an installable Android test app and an iOS simulator app; every
 * Codemagic build waits its turn in one shared queue (position shown, cancellable) and a project starts at most one
 * build an hour (`429 MOBILE_BUILD_RATE_LIMITED` → the time it may build again). Store accounts are owner-only
 * (`OWNER_ONLY` → a note instead of the forms); a signed build whose store is not connected says so instead of failing.
 * Paid plans only — `PLAN_REQUIRED` becomes the upgrade note.
 */
export function MobilePanel({ projectId }: { projectId: string }) {
    const t = useT();
    const { locale } = useLocale();
    const [builds, setBuilds] = React.useState<MobileBuild[] | null>(null);
    const [planRequired, setPlanRequired] = React.useState(false);
    const [enabled, setEnabled] = React.useState<boolean | null>(null);
    const [starting, setStarting] = React.useState(false);
    const [retryAt, setRetryAt] = React.useState<Date | null>(null);
    const [stores, setStores] = React.useState<MobileStores | null>(null);
    const [ownerOnly, setOwnerOnly] = React.useState(false);
    const [uploads, setUploads] = React.useState<StoreUpload[]>([]);
    const [settings, setSettings] = React.useState<MobileSettings | null>(null);
    const [own, setOwn] = React.useState<OwnBuildKey | null>(null);

    const load = React.useCallback(async () => {
        const [response, storesResponse, uploadsResponse, settingsResponse, limitsResponse, ownResponse] = await Promise.all([
            vcaasApi.v2.mobileBuilds(projectId),
            vcaasApi.v2.mobileStores(projectId),
            vcaasApi.v2.storeUploads(projectId),
            vcaasApi.v2.mobileSettings(projectId),
            vcaasApi.v2.limits(projectId),
            vcaasApi.v2.ownBuildKey(projectId),
        ]);
        // owner-only: a member sees neither the offer nor the key
        setOwn(ownResponse.ok ? (ownResponse.data ?? null) : null);
        setSettings(settingsResponse.ok ? (settingsResponse.data ?? null) : null);
        if (codeOf(response) === "PLAN_REQUIRED") setPlanRequired(true);
        setBuilds(response.ok ? (response.data?.builds ?? []) : []);
        setStores(storesResponse.ok ? (storesResponse.data ?? null) : null);
        setOwnerOnly(!storesResponse.ok && codeOf(storesResponse) === "OWNER_ONLY");
        setUploads(uploadsResponse.ok ? (uploadsResponse.data?.uploads ?? []) : []);
        setEnabled(limitsResponse.ok ? (limitsResponse.data?.features?.mobile?.enabled ?? true) : true);
    }, [projectId]);

    React.useEffect(() => {
        void load();
    }, [load]);

    // A build takes minutes; follow it while one is in flight.
    const inFlight =
        builds?.some(build => build.status === "queued" || build.status === "running") ||
        uploads.some(upload => ["queued", "uploading", "processing"].includes(upload.status));
    React.useEffect(() => {
        if (!inFlight) return;
        const timer = window.setInterval(() => void load(), 8_000);
        return () => window.clearInterval(timer);
    }, [inFlight, load]);

    const waiting = !!retryAt && retryAt.getTime() > Date.now();

    const start = async (platform: "android" | "ios") => {
        setStarting(true);
        const response = await vcaasApi.v2.startMobileBuild(projectId, platform);
        setStarting(false);
        const code = codeOf(response);
        if (code === "PLAN_REQUIRED") return setPlanRequired(true);
        if (code === "MOBILE_BUILD_RATE_LIMITED") {
            setRetryAt(retryAtOf(response.details) ?? new Date(Date.now() + 3_600_000));
            return;
        }
        if (!response.ok) toast.error(response.error || t("engineV2.common.failed"));
        else toast.success(t("engineV2.mobile.buildStarted"));
        void load();
    };

    const setMobileEnabled = async (on: boolean) => {
        const response = await vcaasApi.v2.setLimits(projectId, { mobile: { enabled: on } });
        if (response.ok) {
            setEnabled(on);
            toast.success(t(on ? "engineV2.mobile.turnedOn" : "engineV2.mobile.turnedOff"));
        } else toast.error(response.error || t("engineV2.common.failed"));
    };

    const sendToStore = async (build: MobileBuild) => {
        const response = await vcaasApi.v2.startStoreUpload(projectId, build.id);
        if (codeOf(response) === "STORE_NOT_CONFIGURED") toast.error(t("engineV2.mobile.storeNeedsAccount"));
        else if (!response.ok) toast.error(response.error || t("engineV2.common.failed"));
        void load();
    };

    const toggleSendToStores = async (on: boolean) => {
        const response = await vcaasApi.v2.setMobileSettings(projectId, { sendToStoresOnPublish: on });
        if (response.ok && response.data) setSettings(response.data);
        else toast.error(codeOf(response) === "STORE_NOT_CONFIGURED" ? t("engineV2.mobile.storeNeedsAccount") : response.error || t("engineV2.common.failed"));
    };

    const openUrl = async (call: Promise<{ ok: boolean; error?: string; data?: { url: string } | null }>) => {
        const response = await call;
        if (response.ok && response.data?.url) window.open(response.data.url, "_blank", "noopener,noreferrer");
        else toast.error(response.error || t("engineV2.common.failed"));
    };

    const cancel = async (build: MobileBuild) => {
        const response = await vcaasApi.v2.cancelMobileBuild(projectId, build.id);
        if (!response.ok) toast.error(response.error || t("engineV2.common.failed"));
        void load();
    };

    if (planRequired) {
        return <EmptyState variant="panel" icon={<SmartphoneIcon />} title={t("engineV2.mobile.title")} description={t("engineV2.mobile.paidOnly")} />;
    }
    if (builds === null || enabled === null) return <SpinnerBlock />;
    if (!enabled) {
        return (
            <EmptyState
                variant="panel"
                icon={<SmartphoneIcon />}
                title={t("engineV2.mobile.offTitle")}
                description={t("engineV2.mobile.offBody")}
                actions={<Button onClick={() => void setMobileEnabled(true)}>{t("engineV2.mobile.turnOn")}</Button>}
            />
        );
    }

    const busy = starting || inFlight || waiting;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground min-w-0 flex-1 basis-64 text-sm">{t("engineV2.mobile.intro")}</p>
                <label className="flex items-center gap-2 text-xs">
                    {t("engineV2.mobile.enabledLabel")}
                    <Switch checked aria-label={t("engineV2.mobile.enabledLabel")} onCheckedChange={on => void setMobileEnabled(on)} />
                </label>
            </div>

            {/* ── Build ─────────────────────────────────────────────── */}
            <div className="grid gap-3 sm:grid-cols-2">
                <Card title={t("engineV2.mobile.androidTitle")} description={t("engineV2.mobile.androidHint")} icon={<SmartphoneIcon />} testId="mobile-android" className="flex flex-col">
                    <Button className="mt-auto w-full" onClick={() => void start("android")} disabled={busy}>
                        {starting || inFlight ? <LoaderIcon className="size-4 animate-spin" aria-hidden /> : <PlayIcon className="size-4" aria-hidden />}
                        {t("engineV2.mobile.buildTest")}
                    </Button>
                </Card>
                <Card title={t("engineV2.mobile.iosTitle")} description={t("engineV2.mobile.iosHint")} icon={<AppleIcon />} testId="mobile-ios" className="flex flex-col">
                    <Button className="mt-auto w-full" variant="outline" onClick={() => void start("ios")} disabled={busy}>
                        <PlayIcon className="size-4" aria-hidden />
                        {t("engineV2.mobile.buildIosSimulator")}
                    </Button>
                </Card>
            </div>
            {waiting ? (
                <Callout tone="warning" title={t("engineV2.mobile.rateLimitedTitle")} testId="mobile-rate-limited">
                    {t("engineV2.mobile.rateLimitedBody", { time: formatDateTime(retryAt, locale) })}
                </Callout>
            ) : own?.configured ? null : (
                <Callout title={t("engineV2.mobile.rulesTitle")} testId="mobile-rules">
                    {t("engineV2.mobile.rulesBody")}
                </Callout>
            )}
            {own ? <OwnBuildKeyOffer projectId={projectId} own={own} onChanged={setOwn} /> : null}

            {/* ── Builds ────────────────────────────────────────────── */}
            <section className="space-y-2">
                <h3 className="text-base font-semibold">{t("engineV2.mobile.buildsTitle")}</h3>
                {builds.length === 0 ? (
                    <p className="border-border text-muted-foreground rounded-xl border border-dashed p-4 text-center text-sm">{t("engineV2.mobile.empty")}</p>
                ) : (
                    <ul className="space-y-2">
                        {builds.map(build => (
                            <li key={build.id} className="border-border bg-card rounded-xl border p-3 text-sm" data-testid="mobile-build">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="min-w-0 flex-1 basis-48">
                                        <span className="font-medium">{t(build.platform === "ios" ? "engineV2.mobile.iosTitle" : "engineV2.mobile.androidTitle")}</span>{" "}
                                        <span className="text-muted-foreground text-xs">
                                            {build.artifact?.type ?? ""} {build.startedAt ? `· ${formatDateTime(build.startedAt, locale)}` : ""}
                                            {build.trigger === "publish" ? ` · ${t("engineV2.mobile.fromPublish")}` : ""}
                                        </span>
                                    </span>
                                    <StatusPill tone={TONE[build.status]} dot={build.status === "running"} pulse={build.status === "running"}>
                                        {build.queuePosition ? t("engineV2.mobile.queuedPosition", { position: build.queuePosition }) : t(`engineV2.mobile.status_${build.status}`)}
                                    </StatusPill>
                                    {build.queuePosition ? (
                                        <Button size="sm" variant="outline" onClick={() => void cancel(build)}>
                                            {t("engineV2.mobile.cancelBuild")}
                                        </Button>
                                    ) : null}
                                    {storeOf(build) ? (
                                        <Button size="sm" variant="outline" onClick={() => void sendToStore(build)} disabled={inFlight}>
                                            <UploadIcon className="size-3.5" aria-hidden />
                                            {t("engineV2.mobile.sendToStore")}
                                        </Button>
                                    ) : null}
                                    {build.status === "success" && build.artifact ? (
                                        <Button size="sm" onClick={() => void openUrl(vcaasApi.v2.mobileBuildDownload(projectId, build.id))}>
                                            <DownloadIcon className="size-3.5" aria-hidden />
                                            {t("engineV2.mobile.download")}
                                        </Button>
                                    ) : null}
                                </div>
                                {build.queuePosition ? <p className="text-muted-foreground mt-1 text-xs">{t("engineV2.mobile.queuedHint")}</p> : null}
                                {build.error ? <p className="text-destructive mt-1 text-xs">{build.error.message}</p> : null}
                                {build.error?.logExcerpt || build.hasLog ? (
                                    <Disclosure title={t("engineV2.mobile.logTitle")} hint={t("engineV2.mobile.fixHint")} className="mt-2">
                                        {build.error?.logExcerpt ? (
                                            <pre className="bg-muted max-h-48 overflow-auto rounded p-2 text-[11px] leading-snug whitespace-pre-wrap">
                                                {build.error.logExcerpt.split("\n").slice(-20).join("\n")}
                                            </pre>
                                        ) : null}
                                        {build.hasLog ? (
                                            <Button size="sm" variant="outline" onClick={() => void openUrl(vcaasApi.v2.mobileBuildLog(projectId, build.id))}>
                                                <ExternalLinkIcon className="size-3.5" aria-hidden />
                                                {t("engineV2.mobile.fullLog")}
                                            </Button>
                                        ) : null}
                                    </Disclosure>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
                <p className="text-muted-foreground text-xs">{t("engineV2.mobile.installHint")}</p>
            </section>

            {/* ── Stores ────────────────────────────────────────────── */}
            <section className="space-y-2" aria-label={t("engineV2.mobile.storesTitle")}>
                <h3 className="text-base font-semibold">{t("engineV2.mobile.storesTitle")}</h3>
                <p className="text-muted-foreground text-[13px]">{t("engineV2.mobile.storesIntro")}</p>
                {ownerOnly ? (
                    <Callout testId="mobile-owner-only" title={t("engineV2.mobile.ownerOnlyTitle")}>
                        {t("engineV2.mobile.ownerOnlyBody")}
                    </Callout>
                ) : stores ? (
                    <>
                        <div className="grid gap-3 md:grid-cols-2">
                            <GooglePlayCard projectId={projectId} stores={stores} onChanged={load} />
                            <AppStoreCard projectId={projectId} stores={stores} onChanged={load} />
                        </div>
                        {settings ? (
                            <label className="border-border flex items-start gap-3 rounded-xl border p-3 text-sm">
                                <Switch
                                    checked={settings.sendToStoresOnPublish}
                                    disabled={!stores.googlePlay && !stores.appStore}
                                    onCheckedChange={on => void toggleSendToStores(on)}
                                    aria-label={t("engineV2.mobile.sendOnPublish")}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="font-medium">{t("engineV2.mobile.sendOnPublish")}</span>
                                    <span className="text-muted-foreground block text-xs">
                                        {stores.googlePlay || stores.appStore ? t("engineV2.mobile.sendOnPublishHint") : t("engineV2.mobile.sendOnPublishNeedsStore")}
                                    </span>
                                </span>
                            </label>
                        ) : null}
                    </>
                ) : null}
                {uploads.length ? (
                    <ul className="space-y-1.5" aria-label={t("engineV2.mobile.uploadsTitle")}>
                        {uploads.map(upload => (
                            <li key={upload.id} className="border-border flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                                <span className="min-w-0 flex-1">
                                    <span className="font-medium">{upload.store === "google-play" ? t("engineV2.mobile.playInternal") : "TestFlight"}</span>{" "}
                                    <span className="text-muted-foreground text-xs">
                                        {upload.versionName} ({upload.versionCode}) · {formatDateTime(upload.createdAt, locale)}
                                    </span>
                                    {upload.status === "manual_required" ? (
                                        <span className="block text-xs">{t("engineV2.mobile.playFirstUpload", { app: "" })}</span>
                                    ) : upload.error ? (
                                        <span className="text-destructive block text-xs">{upload.error.message}</span>
                                    ) : null}
                                </span>
                                <StatusPill tone={UPLOAD_TONE[upload.status]}>{t(`engineV2.mobile.upload_${upload.status}`)}</StatusPill>
                                {upload.consoleUrl ? (
                                    <a className="text-primary inline-flex items-center gap-1 text-xs" href={upload.consoleUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLinkIcon className="size-3.5" aria-hidden />
                                        {t("engineV2.mobile.openConsole")}
                                    </a>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                ) : null}
            </section>
        </div>
    );
}

/**
 * Bring your own Codemagic API key: a one-line offer that opens a short tutorial and the key field; once set, a note
 * that builds run on the owner's Codemagic account (no shared line, no hourly limit, no build credits). The key is never
 * shown back: only its last 4 characters.
 */
function OwnBuildKeyOffer({ projectId, own, onChanged }: { projectId: string; own: OwnBuildKey; onChanged: (own: OwnBuildKey) => void }) {
    const t = useT();
    const [open, setOpen] = React.useState(false);
    const [token, setToken] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const save = async () => {
        setSaving(true);
        const response = await vcaasApi.v2.setOwnBuildKey(projectId, token.trim());
        setSaving(false);
        if (!response.ok || !response.data) return toast.error(response.error || t("engineV2.common.failed"));
        setToken("");
        setOpen(false);
        onChanged(response.data);
        toast.success(t("engineV2.mobile.byokSaved"));
    };
    const remove = async () => {
        const response = await vcaasApi.v2.removeOwnBuildKey(projectId);
        if (!response.ok) return toast.error(response.error || t("engineV2.common.failed"));
        onChanged({ configured: false, tokenHint: null, addedAt: null });
        toast.success(t("engineV2.mobile.byokRemoved"));
    };
    if (own.configured)
        return (
            <div className="border-border flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm" data-testid="mobile-byok-on">
                <ZapIcon className="text-primary size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 basis-64">{t("engineV2.mobile.byokOn", { hint: own.tokenHint ?? "" })}</span>
                <Button size="sm" variant="ghost" onClick={() => void remove()}>
                    {t("engineV2.mobile.byokRemove")}
                </Button>
            </div>
        );
    return (
        <>
            <button
                type="button"
                data-testid="mobile-byok-offer"
                onClick={() => setOpen(true)}
                className="text-primary inline-flex items-center gap-1.5 text-left text-sm font-medium hover:underline"
            >
                <ZapIcon className="size-4 shrink-0" aria-hidden />
                {t("engineV2.mobile.byokTeaser")}
            </button>
            <Modal
                open={open}
                onOpenChange={setOpen}
                size="md"
                title={t("engineV2.mobile.byokTitle")}
                description={t("engineV2.mobile.byokIntro")}
                footer={
                    <Button disabled={saving || token.trim().length < 8} onClick={() => void save()}>
                        {saving ? t("engineV2.mobile.checking") : t("engineV2.mobile.byokSave")}
                    </Button>
                }
            >
                <div className="space-y-4" data-testid="mobile-byok-tutorial">
                    <ol className="list-decimal space-y-2 pl-5 text-sm">
                        <li>
                            {t("engineV2.mobile.byokStep1")}{" "}
                            <a className="text-primary inline-flex items-center gap-0.5" href="https://codemagic.io/signup" target="_blank" rel="noopener noreferrer">
                                codemagic.io
                                <ExternalLinkIcon className="size-3" aria-hidden />
                            </a>
                        </li>
                        <li>{t("engineV2.mobile.byokStep2")}</li>
                        <li>{t("engineV2.mobile.byokStep3")}</li>
                    </ol>
                    <label className="block space-y-1 text-xs">
                        <span className="font-medium">{t("engineV2.mobile.byokTokenLabel")}</span>
                        <Input className="font-mono" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} />
                    </label>
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                        <LockIcon className="size-3" aria-hidden />
                        {t("engineV2.mobile.byokSafe")}
                    </p>
                </div>
            </Modal>
        </>
    );
}

function StoreCardShell({
    title,
    icon,
    connected,
    detail,
    onDisconnect,
    children,
    testId,
}: {
    title: string;
    icon: React.ReactNode;
    connected: boolean;
    detail: React.ReactNode;
    onDisconnect: () => Promise<void>;
    children: React.ReactNode;
    testId: string;
}) {
    const t = useT();
    const [confirm, setConfirm] = React.useState(false);
    return (
        <Card
            title={title}
            icon={icon}
            testId={testId}
            aside={<StatusPill tone={connected ? "success" : "neutral"}>{t(connected ? "engineV2.mobile.connected" : "engineV2.mobile.notConnected")}</StatusPill>}
        >
            <p className="text-muted-foreground text-xs">{detail}</p>
            {connected ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
                    {t("engineV2.mobile.disconnect")}
                </Button>
            ) : (
                children
            )}
            <ConfirmDialog
                open={confirm}
                onOpenChange={setConfirm}
                tone="danger"
                title={t("engineV2.mobile.disconnectTitle", { store: title })}
                description={t("engineV2.mobile.disconnectBody")}
                confirmLabel={t("engineV2.mobile.disconnect")}
                onConfirm={async () => {
                    await onDisconnect();
                    setConfirm(false);
                }}
            />
        </Card>
    );
}

function GooglePlayCard({ projectId, stores, onChanged }: { projectId: string; stores: MobileStores; onChanged: () => Promise<void> }) {
    const t = useT();
    const [packageName, setPackageName] = React.useState("");
    const [json, setJson] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const play = stores.googlePlay;
    const save = async () => {
        setSaving(true);
        const response = await vcaasApi.v2.connectGooglePlay(projectId, { serviceAccountJson: json.trim(), packageName: packageName.trim() });
        setSaving(false);
        if (response.ok) {
            setJson("");
            toast.success(t("engineV2.mobile.storeSaved"));
            await onChanged();
        } else toast.error(response.error || t("engineV2.common.failed"));
    };
    return (
        <StoreCardShell
            testId="store-google-play"
            title="Google Play"
            icon={<StoreIcon />}
            connected={!!play}
            detail={
                !play
                    ? t("engineV2.mobile.playNotConnected")
                    : play.packageFound
                      ? t("engineV2.mobile.storeConnected", { app: play.packageName })
                      : t("engineV2.mobile.playFirstUpload", { app: ` (${play.packageName})` })
            }
            onDisconnect={async () => {
                const response = await vcaasApi.v2.disconnectStore(projectId, "google-play");
                if (!response.ok) toast.error(response.error || t("engineV2.common.failed"));
                await onChanged();
            }}
        >
            <Disclosure title={t("engineV2.mobile.connectPlay")} testId="connect-google-play">
                <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-xs">
                    <li>{t("engineV2.mobile.playStep1")}</li>
                    <li>{t("engineV2.mobile.playStep2")}</li>
                    <li>{t("engineV2.mobile.playStep3")}</li>
                </ol>
                <label className="block space-y-1 text-xs">
                    <span className="font-medium">{t("engineV2.mobile.packageName")}</span>
                    <Input className="font-mono" placeholder="com.yourcompany.app" value={packageName} onChange={e => setPackageName(e.target.value)} />
                </label>
                <label className="block space-y-1 text-xs">
                    <span className="font-medium">{t("engineV2.mobile.serviceAccount")}</span>
                    <input type="file" accept="application/json,.json" className="block text-xs" onChange={async e => setJson(await readFile(e.target.files?.[0]))} />
                    <Textarea className="h-20 font-mono text-[11px]" placeholder={t("engineV2.mobile.pasteJson")} value={json} onChange={e => setJson(e.target.value)} />
                </label>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <LockIcon className="size-3" aria-hidden />
                    {t("engineV2.mobile.secretsSafe")}
                </p>
                <Button size="sm" disabled={saving || json.trim().length < 100 || !/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(packageName.trim())} onClick={() => void save()}>
                    {saving ? t("engineV2.mobile.checking") : t("engineV2.mobile.connectCheck")}
                </Button>
            </Disclosure>
        </StoreCardShell>
    );
}

function AppStoreCard({ projectId, stores, onChanged }: { projectId: string; stores: MobileStores; onChanged: () => Promise<void> }) {
    const t = useT();
    const [form, setForm] = React.useState({ issuerId: "", keyId: "", bundleId: "", apiKeyP8: "", appAppleId: "" });
    const [saving, setSaving] = React.useState(false);
    const app = stores.appStore;
    const valid = form.apiKeyP8.trim().length >= 100 && /^[A-Z0-9]{10}$/.test(form.keyId.trim()) && form.issuerId.trim().length >= 32 && /\./.test(form.bundleId);
    const save = async () => {
        setSaving(true);
        const signing = await vcaasApi.v2.setIosSigning(projectId, {
            apiKeyP8: form.apiKeyP8.trim(),
            keyId: form.keyId.trim(),
            issuerId: form.issuerId.trim(),
            bundleId: form.bundleId.trim(),
        });
        const response = signing.ok ? await vcaasApi.v2.connectAppStore(projectId, form.appAppleId.trim() ? { appAppleId: form.appAppleId.trim() } : {}) : signing;
        setSaving(false);
        if (response.ok) {
            setForm(f => ({ ...f, apiKeyP8: "" }));
            toast.success(t("engineV2.mobile.storeSaved"));
            await onChanged();
        } else toast.error(response.error || t("engineV2.common.failed"));
    };
    const field = (key: keyof typeof form, label: string, placeholder: string) => (
        <label className="block space-y-1 text-xs">
            <span className="font-medium">{label}</span>
            <Input className="font-mono" placeholder={placeholder} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
        </label>
    );
    return (
        <StoreCardShell
            testId="store-app-store"
            title="App Store (TestFlight)"
            icon={<AppleIcon />}
            connected={!!app}
            detail={app ? t("engineV2.mobile.storeConnected", { app: app.bundleId }) : t("engineV2.mobile.appStoreNotConnected")}
            onDisconnect={async () => {
                const response = await vcaasApi.v2.disconnectStore(projectId, "app-store");
                if (!response.ok) toast.error(response.error || t("engineV2.common.failed"));
                await onChanged();
            }}
        >
            <Disclosure title={t("engineV2.mobile.connectAppStore")} testId="connect-app-store">
                <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-xs">
                    <li>{t("engineV2.mobile.ascStep1")}</li>
                    <li>{t("engineV2.mobile.ascStep2")}</li>
                    <li>{t("engineV2.mobile.ascStep3")}</li>
                </ol>
                {field("issuerId", t("engineV2.mobile.issuerId"), "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx")}
                {field("keyId", t("engineV2.mobile.keyId"), "ABC123DEFG")}
                {field("bundleId", t("engineV2.mobile.bundleId"), "com.yourcompany.app")}
                <label className="block space-y-1 text-xs">
                    <span className="font-medium">{t("engineV2.mobile.p8")}</span>
                    <input type="file" accept=".p8" className="block text-xs" onChange={async e => setForm({ ...form, apiKeyP8: await readFile(e.target.files?.[0]) })} />
                    <Textarea className="h-20 font-mono text-[11px]" placeholder="-----BEGIN PRIVATE KEY-----" value={form.apiKeyP8} onChange={e => setForm({ ...form, apiKeyP8: e.target.value })} />
                </label>
                {field("appAppleId", t("engineV2.mobile.appAppleId"), "1234567890")}
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <LockIcon className="size-3" aria-hidden />
                    {t("engineV2.mobile.secretsSafe")}
                </p>
                <Button size="sm" disabled={saving || !valid} onClick={() => void save()}>
                    {saving ? t("engineV2.mobile.checking") : t("engineV2.mobile.connectCheck")}
                </Button>
            </Disclosure>
        </StoreCardShell>
    );
}
