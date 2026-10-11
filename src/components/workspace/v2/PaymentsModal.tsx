"use client";

import * as React from "react";
import { ExternalLinkIcon, FlaskConicalIcon, RefreshCwIcon, RocketIcon } from "lucide-react";
import { ConfirmDialog, CopyButton, Modal, StatusPill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { useLocale, useT } from "@/i18n";
import { countryOptions } from "@/lib/domain-contact";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import {
    STRIPE_COUNTRIES,
    connectView,
    guessCountry,
    pickStripeCountry,
    liveSwitch,
    onboardingUrls,
    publishFirst,
    type PaymentsMode,
    type PaymentsStatus,
    type ProjectWebhook,
} from "@/lib/v2-payments";
import { Callout, Card, Disclosure } from "./page-bits";

const TONE = { none: "neutral", onboarding: "warning", restricted: "warning", checking: "info", active: "success", disconnected: "danger" } as const;
const TEST_CARD = "4242 4242 4242 4242";

/**
 * Stripe Connect payments of a v2 project (A6.11, plan 15 §4.11, plan 11 §9.4). The owner connects only the live Stripe
 * account (Francesc 2026-10-07): the preview charges test cards on a test account that needs no setup, and the published
 * site charges real cards once the owner turns the switch on. Dev holds no live key (`PAYMENTS_NOT_ENABLED`): there the
 * window says so and keeps test onboarding, so the flow stays testable. Payment events reach the app's own
 * `/api/webhooks/stripe` with no setting (Francesc 2026-10-07); the optional extra address and the own-key option are
 * folded away under Advanced. No fee is ever shown (B12/A6.11). The live account is connected only once the project was
 * published (P2, SDK-API `PAYMENTS_PUBLISH_FIRST`): before that the button is off, with a shortcut to Publish.
 */
export function PaymentsModal({
    open,
    onOpenChange,
    projectId,
    published,
    onPublish,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    published: boolean;
    onPublish: () => void;
}) {
    const t = useT();
    const { locale } = useLocale();
    const [loaded, setLoaded] = React.useState(false);
    const [live, setLive] = React.useState<PaymentsStatus | null>(null);
    const [devTest, setDevTest] = React.useState<PaymentsStatus | null>(null);
    const [liveNotConfigured, setLiveNotConfigured] = React.useState(false);
    const [country, setCountry] = React.useState("");
    const [confirmLive, setConfirmLive] = React.useState(false);
    const [webhook, setWebhook] = React.useState<ProjectWebhook | null>(null);
    const [url, setUrl] = React.useState("");
    const [secret, setSecret] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);

    const load = React.useCallback(async () => {
        const [l, w] = await Promise.all([vcaasApi.v2.paymentsStatus(projectId, "live"), vcaasApi.v2.webhook(projectId)]);
        // This environment has no live Stripe key (dev): SDK-API answers PAYMENTS_NOT_ENABLED for every live path.
        const notConfigured = !l.ok && (l.upstreamCode ?? l.code) === "PAYMENTS_NOT_ENABLED";
        setLiveNotConfigured(notConfigured);
        setLive(l.ok && l.data ? l.data : null);
        if (!l.ok && !notConfigured) toast.error(l.error || t("engineV2.common.failed"));
        if (notConfigured) {
            const s = await vcaasApi.v2.paymentsStatus(projectId, "test");
            setDevTest(s.ok && s.data ? s.data : null);
        }
        if (w.ok && w.data) {
            setWebhook(w.data);
            setUrl(w.data.url ?? "");
        }
        setLoaded(true);
    }, [projectId, t]);

    // Stripe onboarding runs in another tab: coming back to this one re-reads the status.
    React.useEffect(() => {
        if (!open) return;
        void load();
        const onFocus = () => void load();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [open, load]);
    // pre-filled with the account's country (or where the user is), else the browser's language; a pick is never overwritten
    React.useEffect(() => {
        const browser = guessCountry(typeof navigator === "undefined" ? undefined : navigator.language);
        setCountry(c => c || browser);
        // This app has no account profile: the browser's language is the only hint (the platform also asks the account).
        const best = pickStripeCountry(null, browser);
        setCountry(c => (!c || c === browser ? best || c : c));
    }, []);

    const onboard = async (mode: PaymentsMode, withCountry: boolean) => {
        // Stripe sends the user back to this app; served over plain HTTP (local), `NEXT_PUBLIC_APP_URL` names the HTTPS one.
        const urls = onboardingUrls(window.location.origin, projectId, process.env.NEXT_PUBLIC_APP_URL);
        if (!urls) return void toast.error(t("more.paymentsNeedHttps"));
        const tab = window.open("about:blank", "_blank");
        setBusy(true);
        const response = await vcaasApi.v2.paymentsOnboardingLink(projectId, withCountry ? { ...urls, country } : urls, mode);
        setBusy(false);
        if (response.ok && response.data?.url) {
            if (tab) tab.location.href = response.data.url;
            else window.location.href = response.data.url;
        } else {
            tab?.close();
            toast.error(response.error || t("engineV2.common.failed"));
        }
    };

    const setMode = async (mode: PaymentsMode) => {
        setBusy(true);
        const response = await vcaasApi.v2.setPaymentsMode(projectId, mode);
        setBusy(false);
        if (response.ok) toast.success(t(mode === "live" ? "engineV2.payments.nowLive" : "engineV2.payments.nowTest"));
        else toast.error(response.error || t("engineV2.common.failed"));
        void load();
    };

    const saveWebhook = async () => {
        setBusy(true);
        const response = await vcaasApi.v2.setWebhook(projectId, url.trim());
        if (response.ok && response.data && !response.data.secretPrefix) {
            const rotated = await vcaasApi.v2.rotateWebhookSecret(projectId);
            if (rotated.ok && rotated.data) setSecret(rotated.data.secret);
        }
        setBusy(false);
        if (!response.ok) toast.error(response.error || t("engineV2.common.failed"));
        void load();
    };

    const rotate = async () => {
        const response = await vcaasApi.v2.rotateWebhookSecret(projectId);
        if (response.ok && response.data) setSecret(response.data.secret);
        else toast.error(response.error || t("engineV2.common.failed"));
        void load();
    };

    const sw = liveSwitch(live, liveNotConfigured);
    const countries = React.useMemo(() => countryOptions(locale, STRIPE_COUNTRIES), [locale]);

    /** The account card's state, sentence, what Stripe still needs and the one action that moves it on. */
    const account = (s: PaymentsStatus | null, mode: PaymentsMode) => {
        const view = connectView(s);
        const due = s?.requirements.currentlyDue ?? [];
        // a new account (first or after a disconnection) needs the business country; dev's test account defaults it
        const needsCountry = mode === "live" && (view === "none" || view === "disconnected");
        const label = view === "none" ? (mode === "live" ? "connect" : "devConnect") : view === "disconnected" ? "reconnect" : "continue";
        const mustPublish = publishFirst(mode, published, view);
        return (
            <div className="space-y-3">
                <p className="text-muted-foreground text-[13px]">{t(`engineV2.payments.stateBody.${view}`)}</p>
                {(view === "onboarding" || view === "restricted") && due.length > 0 ? <p className="text-warning text-xs">{t("engineV2.payments.due", { count: due.length })}</p> : null}
                {view === "active" || view === "checking" ? null : (
                    <div className="flex flex-wrap items-center gap-2">
                        {needsCountry ? (
                            <div className="flex items-center gap-2 text-xs" data-testid="payments-live-country">
                                {t("engineV2.payments.country")}
                                <SearchableSelect
                                    value={country}
                                    onValueChange={setCountry}
                                    options={countries}
                                    placeholder={t("engineV2.payments.countryPick")}
                                    searchPlaceholder={t("engineV2.domains.countrySearch")}
                                    ariaLabel={t("engineV2.payments.country")}
                                    className="w-56"
                                />
                            </div>
                        ) : null}
                        <Button disabled={busy || mustPublish || (needsCountry && !country)} onClick={() => void onboard(mode, needsCountry)} data-testid={`payments-${mode}-connect`}>
                            <ExternalLinkIcon className="size-4" aria-hidden />
                            {t(`engineV2.payments.${label}`)}
                        </Button>
                    </div>
                )}
                {needsCountry ? <p className="text-muted-foreground text-xs">{t("engineV2.payments.countryFinal")}</p> : null}
                {mustPublish ? (
                    <div className="flex flex-wrap items-center gap-2" data-testid="payments-publish-first">
                        <p className="text-warning text-xs">{t("engineV2.payments.publishFirst")}</p>
                        <Button size="sm" variant="outline" onClick={onPublish}>
                            <RocketIcon className="size-4" aria-hidden />
                            {t("engineV2.payments.publishNow")}
                        </Button>
                    </div>
                ) : null}
            </div>
        );
    };
    const pill = (s: PaymentsStatus | null) => {
        const view = connectView(s);
        return (
            <>
                <StatusPill tone={TONE[view]} data-testid="payments-account-state">
                    {t(`engineV2.payments.state.${view}`)}
                </StatusPill>
                <Button size="icon" variant="ghost" aria-label={t("engineV2.payments.refresh")} onClick={() => void load()}>
                    <RefreshCwIcon className="size-4" aria-hidden />
                </Button>
            </>
        );
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            title={t("engineV2.payments.title")}
            description={t("engineV2.payments.intro")}
            headerAside={
                <StatusPill tone={sw.on ? "success" : "info"} data-testid="payments-mode-now">
                    {t(sw.on ? "engineV2.payments.nowChargingLive" : "engineV2.payments.nowChargingTest")}
                </StatusPill>
            }
        >
            <div className="space-y-4 text-sm">
                {!loaded ? (
                    <Skeleton className="h-36 w-full rounded-xl" />
                ) : liveNotConfigured ? (
                    <Card testId="payments-test-card" title={t("engineV2.payments.devTitle")} aside={pill(devTest)}>
                        <p className="text-muted-foreground flex gap-2 text-xs" data-testid="payments-live-not-configured">
                            <FlaskConicalIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                            {t("engineV2.payments.devBody")}
                        </p>
                        {account(devTest, "test")}
                    </Card>
                ) : (
                    <Card testId="payments-live-card" title={t("engineV2.payments.accountTitle")} aside={pill(live)}>
                        {account(live, "live")}
                        {live?.accountId && connectView(live) !== "disconnected" ? (
                            <a
                                href="https://dashboard.stripe.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                                data-testid="payments-dashboard"
                            >
                                <ExternalLinkIcon className="size-3.5" aria-hidden />
                                {t("engineV2.payments.dashboard")}
                            </a>
                        ) : null}
                        {sw.canToggle ? (
                            <div className="border-border flex items-center gap-3 border-t pt-3" data-testid="payments-mode-switch">
                                <div className="flex-1">
                                    <p className="font-medium">{t("engineV2.payments.liveSwitch")}</p>
                                    <p className="text-muted-foreground text-xs">{t(sw.on ? "engineV2.payments.switchOn" : "engineV2.payments.switchOff")}</p>
                                </div>
                                <Switch
                                    checked={sw.on}
                                    disabled={busy}
                                    aria-label={t("engineV2.payments.liveSwitch")}
                                    onCheckedChange={on => (on ? setConfirmLive(true) : void setMode("test"))}
                                />
                            </div>
                        ) : null}
                    </Card>
                )}

                <Callout testId="payments-preview-note">
                    <span>{t("engineV2.payments.previewNote")}</span>{" "}
                    <span className="inline-flex items-center gap-1 align-middle">
                        <code className="bg-background/70 rounded px-1.5 py-0.5 font-mono text-xs">{TEST_CARD}</code>
                        <CopyButton value={TEST_CARD.replace(/ /g, "")} size="sm" />
                    </span>
                </Callout>

                <Disclosure title={t("engineV2.payments.advancedTitle")} hint={t("engineV2.payments.advancedHint")} testId="payments-advanced">
                    <div className="space-y-2">
                        <p className="font-medium">{t("engineV2.payments.webhookTitle")}</p>
                        <p className="text-muted-foreground text-[13px]">{t("engineV2.payments.webhookBody")}</p>
                        <div className="flex gap-2">
                            <Input placeholder="https://your-server.com/webhooks" value={url} onChange={e => setUrl(e.target.value)} />
                            <Button size="sm" disabled={busy || !url.trim().startsWith("https://") || url.trim() === (webhook?.url ?? "")} onClick={() => void saveWebhook()}>
                                {t("common.save")}
                            </Button>
                        </div>
                        {webhook?.secretPrefix ? (
                            <p className="text-muted-foreground flex items-center gap-2 text-xs">
                                {t("engineV2.payments.secretPrefix", { prefix: webhook.secretPrefix })}
                                <Button size="sm" variant="ghost" onClick={() => void rotate()}>
                                    {t("engineV2.payments.rotate")}
                                </Button>
                            </p>
                        ) : null}
                        {secret ? (
                            <p className="bg-muted flex items-center gap-2 rounded-md p-2 font-mono text-xs break-all">
                                {secret}
                                <CopyButton value={secret} />
                            </p>
                        ) : null}
                        {secret ? <p className="text-warning text-xs">{t("engineV2.payments.secretOnce")}</p> : null}
                    </div>
                    <p className="text-muted-foreground text-xs" data-testid="payments-own-key">
                        {t("engineV2.payments.byok")}
                    </p>
                </Disclosure>
            </div>
            <ConfirmDialog
                open={confirmLive}
                onOpenChange={setConfirmLive}
                title={t("engineV2.payments.confirmLiveTitle")}
                description={t("engineV2.payments.confirmLiveBody")}
                confirmLabel={t("engineV2.payments.confirmLive")}
                onConfirm={() => setMode("live")}
            />
        </Modal>
    );
}
