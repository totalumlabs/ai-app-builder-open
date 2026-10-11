"use client";

import * as React from "react";
import { ChevronRightIcon, InfoIcon, LifeBuoyIcon, Link2Icon, ShoppingCartIcon } from "lucide-react";
import { useT } from "@/i18n";
import { apexOf, isApexHostname, servedHostname } from "@/lib/domain-connect";
import type { VcaasDomainSslStatus } from "@/lib/vcaas-types";

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

/** After connecting a whole domain: the bare apex needs a redirect to `www` at the user's provider. */
export function ApexRedirectNote({ hostname }: { hostname: string }) {
    const t = useT();
    const apex = apexOf(hostname);
    if (!apex) return null;
    return (
        <p className="bg-muted/40 flex items-start gap-1.5 rounded-lg p-2.5 text-xs" data-testid="domain-apex-note">
            <InfoIcon className="text-primary mt-px size-3.5 shrink-0" aria-hidden />
            <span>{t("workspace.domain.connect.apexRedirect", { apex, www: hostname })}</span>
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
