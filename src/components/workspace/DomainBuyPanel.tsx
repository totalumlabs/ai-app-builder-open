"use client";

import * as React from "react";
import Link from "next/link";
import {
    CheckCircle2Icon,
    CreditCardIcon,
    GlobeIcon,
    LoaderIcon,
    MailIcon,
    SearchIcon,
    TriangleAlertIcon,
} from "lucide-react";
import { StatusPill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DomainContactForm, registrantFor, type SavedContact } from "@/components/settings/DomainContactForm";
import { EMPTY_CONTACT, contactComplete, latestSavedContact, renewsAtAnotherPrice, type Contact } from "@/lib/domain-contact";
import { useLocale, useT } from "@/i18n";
import type { TranslationKey } from "@/i18n/types";
import { attachWarningKey, purchaseErrorKey } from "@/lib/domain-connect";
import { DEFAULT_PREFIX, isValidPrefix } from "@/lib/domain-prefix";
import { vcaasApi } from "@/lib/vcaas";
import type { DomainSearchResult } from "@/lib/vcaas-types";
import { DomainPrefixField } from "./DomainConnectGuide";

function money(value: number, currency: string, locale: string) {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}

type Step =
    | { kind: "search" }
    | { kind: "confirm"; result: DomainSearchResult }
    | { kind: "buying"; result: DomainSearchResult }
    | { kind: "done"; domain: string; verificationPending: boolean; warning: string | null }
    | { kind: "failed"; result: DomainSearchResult; messageKey: string | null; message: string };

/**
 * "Buy a new domain" inside the project's custom-domain modal (domodal): the Settings → Domains search and purchase
 * (`DomainsSettings`, same VCaaS routes, same contact fields), plus `projectId` on the purchase so the domain is
 * attached to THIS project in the same call (builder-api's purchase saga: card → registrar → attach; a failed attach
 * never undoes the purchase and comes back as a warning). Prices are the customer prices the API quotes.
 */
export function DomainBuyPanel({
    projectId,
    attachFee,
    monthlyFee,
    onBought,
    onDone,
}: {
    projectId: string;
    /** Already-formatted credit prices (`usePrice`): the one-off attach fee and the monthly fee. */
    attachFee: string;
    monthlyFee: string;
    /** The purchase finished (attached or not): the parent re-reads the project. */
    onBought: () => void;
    /** "See the setup progress" on the success screen: the parent shows the attached domain. */
    onDone: () => void;
}) {
    const t = useT();
    const tk = (key: string, vars?: Record<string, string | number>) => t(key as TranslationKey, vars);
    const { locale } = useLocale();
    const [query, setQuery] = React.useState("");
    const [results, setResults] = React.useState<DomainSearchResult[] | null>(null);
    const [searching, setSearching] = React.useState(false);
    const [searchError, setSearchError] = React.useState<string | null>(null);
    /** `undefined` while the saved contacts load. */
    const [saved, setSaved] = React.useState<SavedContact | null | undefined>(undefined);
    const [contact, setContact] = React.useState<Contact>(EMPTY_CONTACT);
    const [step, setStep] = React.useState<Step>({ kind: "search" });
    /** The site answers on `<prefix>.<domain>` (or the bare domain for `apex`); sent as `canonicalHost`. */
    const [prefix, setPrefix] = React.useState<string>(DEFAULT_PREFIX);

    React.useEffect(() => {
        void vcaasApi.v2.domainContacts().then(r => {
            const latest = r.ok ? latestSavedContact(r.data) : null;
            setSaved(latest);
            if (latest) setContact(latest.contact);
        });
    }, []);

    const search = async (event?: React.FormEvent) => {
        event?.preventDefault();
        const q = query.trim();
        if (!q || searching) return;
        setSearching(true);
        setSearchError(null);
        const response = await vcaasApi.v2.searchDomains(q);
        setSearching(false);
        if (response.ok) setResults(response.data?.results ?? []);
        else
            setSearchError(
                response.upstreamCode === "ENGINE_UNAVAILABLE" || response.upstreamCode === "PROVIDER_UNAVAILABLE"
                    ? t("workspace.domain.buy.searchUnavailable")
                    : response.error || t("engineV2.common.failed")
            );
    };

    const buy = async (result: DomainSearchResult) => {
        setStep({ kind: "buying", result });
        const registrant = await registrantFor(saved ?? null, contact);
        if ("error" in registrant)
            return setStep({ kind: "failed", result, messageKey: null, message: registrant.error || t("engineV2.common.failed") });
        setSaved(registrant.saved);
        const response = await vcaasApi.v2.purchaseDomain({ domain: result.domain, contactId: registrant.saved.id, expectedPrice: result.price, projectId, canonicalHost: prefix });
        if (!response.ok) {
            return setStep({
                kind: "failed",
                result,
                messageKey: purchaseErrorKey(response.upstreamCode ?? response.code),
                message: response.error || t("engineV2.common.failed"),
            });
        }
        const answer = response.data as unknown as {
            domain?: { contactVerificationPending?: boolean };
            warnings?: { code: string }[];
        };
        setStep({
            kind: "done",
            domain: result.domain,
            verificationPending: answer?.domain?.contactVerificationPending !== false,
            warning: attachWarningKey(answer?.warnings),
        });
        onBought();
    };

    if (step.kind === "done") {
        return (
            <div className="space-y-4" data-testid="domain-buy-done">
                <div className="border-success/40 bg-success-subtle rounded-xl border p-4 text-center">
                    <CheckCircle2Icon className="text-success mx-auto mb-2 size-7" aria-hidden />
                    <p className="text-base font-semibold">{t("workspace.domain.buy.doneTitle", { domain: step.domain })}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {step.warning ? tk(step.warning) : t("workspace.domain.buy.doneBody")}
                    </p>
                </div>
                {step.verificationPending && (
                    <div className="border-warning/40 bg-warning-subtle text-warning-subtle-foreground flex gap-2.5 rounded-lg border p-3 text-xs">
                        <MailIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <p>{t("workspace.domain.buy.verifyNote")}</p>
                    </div>
                )}
                {/* This app manages bought domains in the same section (below), not on a settings page. */}
                <Button size="sm" onClick={onDone}>
                    {t("workspace.domain.buy.seeProgress")}
                </Button>
            </div>
        );
    }

    if (step.kind !== "search") {
        const { result } = step;
        const busy = step.kind === "buying";
        return (
            <div className="space-y-4">
                <div className="border-border rounded-xl border p-4">
                    <div className="flex items-center gap-2">
                        <GlobeIcon className="text-primary size-4 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">{result.domain}</span>
                        <span className="text-sm font-semibold tabular-nums">{money(result.price, result.currency, locale)}</span>
                    </div>
                    <dl className="text-muted-foreground mt-3 space-y-1.5 text-xs">
                        <div className="flex justify-between gap-3">
                            <dt>{t("workspace.domain.buy.renewal")}</dt>
                            <dd className="tabular-nums">{t("workspace.domain.buy.perYear", { price: money(result.renewalPrice, result.currency, locale) })}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt>{t("workspace.domain.buy.connectFee")}</dt>
                            <dd className="text-right">{t("workspace.domain.buy.connectFeeValue", { price: attachFee, monthly: monthlyFee })}</dd>
                        </div>
                    </dl>
                    <p className="text-muted-foreground mt-3 flex items-start gap-1.5 text-xs">
                        <CreditCardIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                        {t("workspace.domain.buy.cardNote", { price: money(result.price, result.currency, locale) })}
                    </p>
                </div>

                {!busy && <DomainPrefixField domain={result.domain} value={prefix} onChange={setPrefix} />}

                {saved !== undefined && !busy && <DomainContactForm value={contact} onChange={setContact} saved={saved !== null} />}

                {busy && (
                    <div role="status" className="bg-muted/40 flex items-center gap-3 rounded-lg p-3 text-sm">
                        <LoaderIcon className="text-primary size-4 shrink-0 animate-spin" aria-hidden />
                        <span>
                            <span className="block font-medium">{t("workspace.domain.buy.buying")}</span>
                            <span className="text-muted-foreground block text-xs">{t("workspace.domain.buy.buyingHint")}</span>
                        </span>
                    </div>
                )}

                {step.kind === "failed" && (
                    <div role="alert" className="border-destructive/40 bg-destructive-subtle text-destructive-subtle-foreground flex gap-2.5 rounded-lg border p-3 text-xs">
                        <TriangleAlertIcon className="text-destructive mt-px size-4 shrink-0" aria-hidden />
                        <div className="space-y-1.5">
                            <p>{step.messageKey ? tk(step.messageKey) : step.message}</p>
                            {step.messageKey === "workspace.domain.buy.errNoCard" || step.messageKey === "workspace.domain.buy.errDeclined" ? (
                                // The card is the Totalum account's own, saved on the Totalum platform.
                                <Link href="https://platform.totalum.app/billing" target="_blank" rel="noreferrer" className="text-primary font-medium underline-offset-2 hover:underline">
                                    {t("workspace.domain.buy.addCard")}
                                </Link>
                            ) : null}
                        </div>
                    </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => setStep({ kind: "search" })}>
                        {t("workspace.domain.buy.otherDomain")}
                    </Button>
                    <Button size="sm" disabled={busy || saved === undefined || !contactComplete(contact) || !isValidPrefix(prefix)} onClick={() => void buy(result)}>
                        {busy ? <LoaderIcon className="size-4 animate-spin" aria-hidden /> : <CreditCardIcon className="size-4" aria-hidden />}
                        {t("workspace.domain.buy.payButton", { price: money(result.price, result.currency, locale) })}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <form onSubmit={search} className="flex gap-2">
                <Input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={t("engineV2.domains.searchPlaceholder")}
                    aria-label={t("engineV2.domains.searchPlaceholder")}
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                />
                <Button type="submit" disabled={searching || !query.trim()}>
                    {searching ? <LoaderIcon className="size-4 animate-spin" aria-hidden /> : <SearchIcon className="size-4" aria-hidden />}
                    <span className="sr-only sm:not-sr-only">{t("engineV2.domains.search")}</span>
                </Button>
            </form>

            {searchError && <p className="text-destructive text-xs">{searchError}</p>}

            {results && results.length === 0 && !searching && (
                <p className="text-muted-foreground text-sm">{t("workspace.domain.buy.noResults")}</p>
            )}

            {results && results.length > 0 && (
                <ul className="space-y-1.5" data-testid="domain-buy-results">
                    {results.map(result => (
                        <li
                            key={result.domain}
                            className="border-border flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 text-sm"
                        >
                            <span className="min-w-0 flex-1 truncate font-mono font-medium">{result.domain}</span>
                            {result.available ? (
                                <>
                                    <span className="text-right">
                                        <span className="block font-semibold tabular-nums">{money(result.price, result.currency, locale)}</span>
                                        <span className="text-muted-foreground block text-2xs">
                                            {t(renewsAtAnotherPrice(result) ? "workspace.domain.buy.firstYearThen" : "workspace.domain.buy.thenPerYear", {
                                                price: money(result.renewalPrice, result.currency, locale),
                                            })}
                                        </span>
                                    </span>
                                    <Button size="sm" onClick={() => setStep({ kind: "confirm", result })}>
                                        {t("engineV2.domains.buy")}
                                    </Button>
                                </>
                            ) : (
                                <StatusPill tone="neutral">{t("engineV2.domains.taken")}</StatusPill>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <p className="text-muted-foreground text-xs">{t("engineV2.domains.ownership")}</p>
        </div>
    );
}
