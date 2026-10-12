"use client";

import * as React from "react";
import { ChevronRightIcon, InfoIcon, LifeBuoyIcon, Link2Icon, ShoppingCartIcon } from "lucide-react";
import { useT } from "@/i18n";
import { Input } from "@/components/ui/input";
import { apexOf, isApexHostname, servedHostname } from "@/lib/domain-connect";
import { PREFIX_PRESETS, isValidPrefix, normalisePrefix, siteHostname } from "@/lib/domain-prefix";
import { cn } from "@/lib/utils";
import type { VcaasDomainHostname, VcaasDomainSslStatus } from "@/lib/vcaas-types";

/**
 * The presentational pieces of the v2 custom-domain modal (domodal): the "buy or connect" choice, the apex/`www`
 * guidance, the HTTPS line and the troubleshooting tips. No data fetching here — `DomainModal` owns that — so the
 * tests render these with the real dictionaries.
 */

export function DomainChoice({ onChoose }: { onChoose: (path: "buy" | "connect") => void }) {
    const t = useT();
    const options = [
        { path: "buy" as const, icon: ShoppingCartIcon, title: t("workspace.domain.choice.buyTitle"), body: t("workspace.domain.choice.buyBody") },
        { path: "connect" as const, icon: Link2Icon, title: t("workspace.domain.choice.connectTitle"), body: t("workspace.domain.choice.connectBody") },
    ];
    return (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="domain-choice">
            {options.map(({ path, icon: Icon, title, body }) => (
                <button
                    key={path}
                    type="button"
                    data-testid={`domain-choice-${path}`}
                    onClick={() => onChoose(path)}
                    className="group border-border hover:border-primary/60 hover:bg-primary-subtle/40 focus-visible:ring-ring flex flex-col gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                    <span aria-hidden className="bg-primary-subtle text-primary grid size-10 place-items-center rounded-lg">
                        <Icon className="size-5" />
                    </span>
                    <span className="flex-1">
                        <span className="block text-sm font-semibold">{title}</span>
                        <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">{body}</span>
                    </span>
                    <span className="text-primary flex items-center gap-1 text-xs font-medium">
                        {t("workspace.domain.choice.start")}
                        <ChevronRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                </button>
            ))}
        </div>
    );
}

/** Before connecting: what a typed whole domain becomes (served on `www.`, the apex redirects there). */
export function ApexPreview({ hostname }: { hostname: string }) {
    const t = useT();
    if (!isApexHostname(hostname)) return null;
    return (
        <p className="bg-muted/40 flex items-start gap-1.5 rounded-lg p-2.5 text-xs" data-testid="domain-apex-preview">
            <InfoIcon className="text-primary mt-px size-3.5 shrink-0" aria-hidden />
            <span>{t("workspace.domain.connect.apexPreview", { apex: hostname, www: servedHostname(hostname) })}</span>
        </p>
    );
}

/**
 * After connecting a whole domain: how the bare domain reaches the site. When the engine lists `A`/`AAAA` records for
 * it (Totalum's redirect service, which 301s to `https://<site>`), they are in the records list and work at any
 * provider; otherwise the bare apex of a `www.` site needs a URL redirect at the user's provider.
 */
export function ApexRedirectNote({ hostname, hostnames }: { hostname: string; hostnames?: VcaasDomainHostname[] }) {
    const t = useT();
    const redirect = hostnames?.find(h => h.role === "alias" && h.dnsRecordsToAdd?.some(r => r.type === "A" || r.type === "AAAA"));
    const apex = redirect?.hostname ?? apexOf(hostname);
    if (!apex) return null;
    return (
        <p className="bg-muted/40 flex items-start gap-1.5 rounded-lg p-2.5 text-xs" data-testid="domain-apex-note">
            <InfoIcon className="text-primary mt-px size-3.5 shrink-0" aria-hidden />
            <span>{t(redirect ? "workspace.domain.connect.apexRedirectRecords" : "workspace.domain.connect.apexRedirect", { apex, www: hostname })}</span>
        </p>
    );
}

const SSL_LABEL: Record<string, "sslActive" | "sslPending" | "sslFailed"> = {
    active: "sslActive",
    expired: "sslFailed",
    deleted: "sslFailed",
    validation_timed_out: "sslFailed",
    issuance_timed_out: "sslFailed",
};

export function SslLine({ sslStatus }: { sslStatus: VcaasDomainSslStatus | string | undefined }) {
    const t = useT();
    const key = SSL_LABEL[sslStatus ?? ""] ?? "sslPending";
    const dot = key === "sslActive" ? "bg-success" : key === "sslFailed" ? "bg-destructive" : "bg-warning animate-pulse";
    return (
        <p className="text-muted-foreground flex items-center gap-2 text-xs" data-testid="domain-ssl">
            <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
            <span>
                {t("workspace.domain.connect.sslLabel")} <span className="text-foreground font-medium">{t(`workspace.domain.connect.${key}`)}</span>
            </span>
        </p>
    );
}

const TIPS = ["tipProvider", "tipConflicts", "tipName", "tipProxy", "tipWait"] as const;

export function DomainTroubleshooting() {
    const t = useT();
    return (
        <details className="border-border group rounded-lg border" data-testid="domain-troubleshooting">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium">
                <LifeBuoyIcon className="text-muted-foreground size-3.5" aria-hidden />
                <span className="flex-1">{t("workspace.domain.connect.troubleTitle")}</span>
                <ChevronRightIcon className="text-muted-foreground size-3.5 transition-transform group-open:rotate-90" aria-hidden />
            </summary>
            <ul className="text-muted-foreground list-disc space-y-1.5 px-3 pb-3 pl-7 text-xs leading-relaxed">
                {TIPS.map(tip => (
                    <li key={tip}>{t(`workspace.domain.connect.${tip}`)}</li>
                ))}
            </ul>
        </details>
    );
}

/**
 * Where a bought domain's site answers: `www` (default), `app`, or any label typed in "Other", or the bare domain
 * (`apex`). Below it, the address that results, so the choice is never abstract (the bare domain 301s to the site).
 */
export function DomainPrefixField({ domain, value, onChange }: { domain: string; value: string; onChange: (prefix: string) => void }) {
    const t = useT();
    const [other, setOther] = React.useState(!PREFIX_PRESETS.includes(value));
    const valid = isValidPrefix(value); // "apex" is a valid label too
    const chip = (active: boolean) =>
        cn(
            "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            active ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-accent",
        );
    return (
        <fieldset className="space-y-2" data-testid="domain-prefix">
            <legend className="text-xs font-medium">{t("workspace.domain.prefix.label")}</legend>
            <div className="flex flex-wrap items-center gap-1.5">
                {PREFIX_PRESETS.map(p => (
                    <button
                        key={p}
                        type="button"
                        aria-pressed={!other && value === p}
                        className={chip(!other && value === p)}
                        onClick={() => {
                            setOther(false);
                            onChange(p);
                        }}
                    >
                        {p === "apex" ? domain : `${p}.`}
                    </button>
                ))}
                <button
                    type="button"
                    aria-pressed={other}
                    className={chip(other)}
                    onClick={() => {
                        setOther(true);
                        if (PREFIX_PRESETS.includes(value)) onChange("");
                    }}
                >
                    {t("workspace.domain.prefix.other")}
                </button>
                {other && (
                    <Input
                        value={value}
                        onChange={event => onChange(normalisePrefix(event.target.value))}
                        placeholder="shop"
                        aria-label={t("workspace.domain.prefix.otherLabel")}
                        aria-invalid={value !== "" && !valid}
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                        className={cn("h-7 w-32 font-mono text-xs", value !== "" && !valid && "border-destructive")}
                    />
                )}
            </div>
            {value !== "" && !valid ? (
                <p className="text-destructive text-xs">{t("workspace.domain.prefix.invalid")}</p>
            ) : valid ? (
                <p className="text-muted-foreground text-xs" data-testid="domain-prefix-preview">
                    {value === "apex"
                        ? t("workspace.domain.prefix.previewApex", { site: domain })
                        : t("workspace.domain.prefix.preview", { site: siteHostname(domain, value), apex: domain })}
                </p>
            ) : null}
        </fieldset>
    );
}

/**
 * Each address of the custom domain on its own line: the site, and the bare domain that 301s to it (Totalum's redirect
 * service). Each is "working" once the engine reports it active with HTTPS — for the redirect, once it answers the 301.
 */
export function DomainHostnames({ site, hostnames }: { site: string; hostnames: VcaasDomainHostname[] }) {
    const t = useT();
    return (
        <ul className="border-border mt-3 space-y-1.5 border-t pt-3 text-xs" data-testid="domain-hostnames">
            {hostnames.map(h => {
                const live = h.status === "active" && h.sslStatus === "active";
                return (
                    <li key={h.hostname} className="flex flex-wrap items-center gap-2">
                        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", live ? "bg-emerald-500" : "bg-warning animate-pulse")} />
                        <code className="font-mono">{h.hostname}</code>
                        <span className="text-muted-foreground">
                            {h.role === "alias" ? t("workspace.domain.hostRedirect", { site }) : t("workspace.domain.hostSite")}
                            {" · "}
                            {live ? t("workspace.domain.hostLive") : t("workspace.domain.hostPending")}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
