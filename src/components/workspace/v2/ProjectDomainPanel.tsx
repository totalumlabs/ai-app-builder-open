"use client";

import * as React from "react";
import { ConfirmDialog, Modal, StatusPill } from "@/components/primitives";
import { DomainManager } from "@/components/settings/DomainManager";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLocale, useT } from "@/i18n";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import type { AccountDomain, VcaasProject } from "@/lib/vcaas-types";
import { isValidPrefix, siteHostname } from "@/lib/domain-prefix";
import { DomainPrefixField } from "../DomainConnectGuide";
import { DomainModal } from "../DomainModal";

const noop = () => {};

/**
 * More → Custom domain. The top half is the platform's domain dialog laid out in place: buy a new domain or connect
 * one the user already owns, then the DNS / HTTPS progress. The bottom half manages the domains bought on Totalum
 * (`/domains/*`): the one serving this project (auto-renew, where the site answers, DNS records, forwarding, renew,
 * transfer code, disconnect) and the account's free ones, which can be attached here.
 *
 * Where the site answers is the `canonicalHost` prefix (`www`, `app`, any label, or `apex`). Changing it = attaching the
 * same domain to the same project again with another prefix: the API moves the site, no second fee.
 */
export function ProjectDomainPanel({ project, onChanged }: { project: VcaasProject; onChanged: () => void }) {
    const t = useT();
    const { locale } = useLocale();
    const projectId = project.projectId;
    const [domains, setDomains] = React.useState<AccountDomain[] | null>(null);
    const [open, setOpen] = React.useState<string | null>(null);
    const [detaching, setDetaching] = React.useState<AccountDomain | null>(null);
    /** The prefix picked per domain, before it is applied. */
    const [prefixes, setPrefixes] = React.useState<Record<string, string>>({});
    const [busy, setBusy] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        const response = await vcaasApi.v2.domains();
        setDomains(response.ok ? (response.data?.domains ?? []) : []);
    }, []);
    React.useEffect(() => {
        void load();
    }, [load]);

    // The domains list can lag a write by a few seconds, so a successful write is applied to it here, not re-read.
    const patch = (id: string, change: Partial<AccountDomain>) => setDomains((list) => list?.map((d) => (d.id === id ? { ...d, ...change } : d)) ?? null);

    const attached = (domains ?? []).filter((d) => d.attachedProjectId === projectId);
    const free = (domains ?? []).filter((d) => !d.attachedProjectId && d.status === "active");

    /** Where the site answers now: the project's view first (it is the engine's), then the domains list. */
    const currentPrefix = (domain: AccountDomain) => project.customDomain?.canonicalHost ?? domain.canonicalHost ?? "www";
    const prefixOf = (domain: AccountDomain) => prefixes[domain.id] ?? (domain.attachedProjectId ? currentPrefix(domain) : "www");

    /** Attach a free domain, or attach again with another prefix to move the site (no second fee). */
    const attach = async (domain: AccountDomain) => {
        const prefix = prefixOf(domain);
        const moving = domain.attachedProjectId === projectId;
        setBusy(domain.id);
        const response = await vcaasApi.v2.attachDomain(domain.id, projectId, prefix);
        setBusy(null);
        if (!response.ok) return void toast.error(response.error || t("engineV2.common.failed"));
        toast.success(moving ? t("workspace.domain.prefix.moved", { site: siteHostname(domain.domain, prefix) }) : t("engineV2.domains.attached"));
        patch(domain.id, { attachedProjectId: projectId, canonicalHost: prefix });
        onChanged();
    };
    const prefixField = (domain: AccountDomain) => (
        <DomainPrefixField domain={domain.domain} value={prefixOf(domain)} onChange={(prefix) => setPrefixes((all) => ({ ...all, [domain.id]: prefix }))} />
    );

    return (
        <div className="space-y-8">
            <DomainModal open onOpenChange={noop} projectId={projectId} project={project} onChanged={onChanged} />

            {/* An (inline) Modal, so the disconnect confirmation inside it opens as a real dialog. */}
            <Modal open onOpenChange={noop} title={t("more.boughtTitle")}>
                <div className="space-y-3">
                    {domains === null ? <p className="text-muted-foreground text-sm">{t("common.loading")}</p> : null}
                    {domains !== null && attached.length === 0 && free.length === 0 ? (
                        <p className="text-muted-foreground text-sm">{t("engineV2.domains.none")}</p>
                    ) : null}
                    <ul className="space-y-1.5">
                        {attached.map((domain) => (
                            <li key={domain.id} className="border-border flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                                <span className="min-w-0 flex-1">
                                    <span className="font-medium">{domain.domain}</span>{" "}
                                    <span className="text-muted-foreground text-xs">
                                        {t("engineV2.domains.expires", { date: formatDate(domain.expiresAt, locale) })}
                                    </span>
                                </span>
                                <StatusPill tone={domain.status === "active" ? "success" : "warning"}>{domain.status}</StatusPill>
                                <label className="flex items-center gap-1.5 text-xs">
                                    <Switch
                                        checked={domain.autoRenew}
                                        onCheckedChange={async (autoRenew) => {
                                            const response = await vcaasApi.v2.setDomainAutoRenew(domain.id, autoRenew);
                                            if (response.ok) patch(domain.id, { autoRenew });
                                            else toast.error(response.error || t("engineV2.common.failed"));
                                        }}
                                    />
                                    {t("engineV2.domains.autoRenew")}
                                </label>
                                <Button size="sm" variant="outline" onClick={() => setDetaching(domain)}>
                                    {t("engineV2.domains.disconnect")}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    aria-expanded={open === domain.id}
                                    onClick={() => setOpen((current) => (current === domain.id ? null : domain.id))}
                                >
                                    {t("engineV2.domains.manageDomain")}
                                </Button>
                                <div className="w-full space-y-2">
                                    {prefixField(domain)}
                                    {prefixOf(domain) !== currentPrefix(domain) && isValidPrefix(prefixOf(domain)) ? (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button size="sm" disabled={busy !== null} onClick={() => void attach(domain)}>
                                                {t("workspace.domain.prefix.move")}
                                            </Button>
                                            <p className="text-muted-foreground text-xs">{t("workspace.domain.prefix.moveNote")}</p>
                                        </div>
                                    ) : null}
                                </div>
                                {open === domain.id ? (
                                    <DomainManager domain={domain} onChanged={(updated) => (updated ? patch(domain.id, updated) : void load())} />
                                ) : null}
                            </li>
                        ))}
                        {attached.length === 0
                            ? free.map((domain) => (
                                  <li key={domain.id} className="border-border flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                                      <span className="min-w-0 flex-1 font-medium">{domain.domain}</span>
                                      <Button size="sm" disabled={busy !== null || !isValidPrefix(prefixOf(domain))} onClick={() => void attach(domain)}>
                                          {t("more.attachHere")}
                                      </Button>
                                      <div className="w-full">{prefixField(domain)}</div>
                                  </li>
                              ))
                            : null}
                    </ul>
                </div>

                <ConfirmDialog
                    open={detaching !== null}
                    onOpenChange={(next) => !next && setDetaching(null)}
                    tone="danger"
                    title={t("engineV2.domains.disconnectTitle", { domain: detaching?.domain ?? "" })}
                    description={t("engineV2.domains.disconnectBody", { project: project.label || projectId })}
                    confirmLabel={t("engineV2.domains.disconnect")}
                    onConfirm={async () => {
                        if (!detaching) return;
                        const response = await vcaasApi.v2.detachDomain(detaching.id);
                        if (!response.ok) return void toast.error(response.error || t("engineV2.common.failed"));
                        toast.success(t("engineV2.domains.disconnected", { domain: detaching.domain }));
                        patch(detaching.id, { attachedProjectId: undefined });
                        onChanged();
                    }}
                />
            </Modal>
        </div>
    );
}
