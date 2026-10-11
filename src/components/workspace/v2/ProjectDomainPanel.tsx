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
import { DomainModal } from "../DomainModal";

const noop = () => {};

/**
 * More → Custom domain. The top half is the platform's domain dialog laid out in place: buy a new domain or connect
 * one the user already owns, then the DNS / HTTPS progress. The bottom half manages the domains bought on Totalum
 * (`/domains/*`): the one serving this project (auto-renew, which host is the main address, DNS records, forwarding,
 * renew, transfer code, disconnect) and the account's free ones, which can be attached here.
 *
 * TODO(api): two controls of the platform's domain view have no documented VCaaS endpoint yet, so they are not here:
 *   - changing the main host of an ATTACHED domain (today `canonicalHost` is only accepted on attach / purchase);
 *   - an `app.` prefix as the main host (the documented choice is `www` or the bare domain, `apex`).
 */
export function ProjectDomainPanel({ project, onChanged }: { project: VcaasProject; onChanged: () => void }) {
    const t = useT();
    const { locale } = useLocale();
    const projectId = project.projectId;
    const [domains, setDomains] = React.useState<AccountDomain[] | null>(null);
    const [open, setOpen] = React.useState<string | null>(null);
    const [detaching, setDetaching] = React.useState<AccountDomain | null>(null);
    const [host, setHost] = React.useState<"www" | "apex">("www");

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

    const attach = async (domain: AccountDomain) => {
        const response = await vcaasApi.v2.attachDomain(domain.id, projectId, host);
        if (!response.ok) return void toast.error(response.error || t("engineV2.common.failed"));
        toast.success(t("engineV2.domains.attached"));
        patch(domain.id, { attachedProjectId: projectId, canonicalHost: host });
        onChanged();
    };

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
                                    <span className="text-muted-foreground block text-xs">
                                        {t(domain.canonicalHost === "apex" ? "more.hostApex" : "more.hostWww", { domain: domain.domain })}
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
                                {open === domain.id ? (
                                    <DomainManager domain={domain} onChanged={(updated) => (updated ? patch(domain.id, updated) : void load())} />
                                ) : null}
                            </li>
                        ))}
                        {attached.length === 0
                            ? free.map((domain) => (
                                  <li key={domain.id} className="border-border flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                                      <span className="min-w-0 flex-1 font-medium">{domain.domain}</span>
                                      <select
                                          className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                                          aria-label={t("more.hostLabel")}
                                          value={host}
                                          onChange={(e) => setHost(e.target.value as "www" | "apex")}
                                      >
                                          <option value="www">www.{domain.domain}</option>
                                          <option value="apex">{domain.domain}</option>
                                      </select>
                                      <Button size="sm" onClick={() => void attach(domain)}>
                                          {t("more.attachHere")}
                                      </Button>
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
