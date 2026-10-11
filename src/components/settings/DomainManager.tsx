"use client";

import * as React from "react";
import { CopyIcon, LockIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { ConfirmDialog } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale, useT } from "@/i18n";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import type { AccountDomain, DomainDnsRecord, DomainDnsRecordInput, DomainForward } from "@/lib/vcaas-types";

const TYPES: DomainDnsRecordInput["type"][] = ["A", "AAAA", "CNAME", "ALIAS", "MX", "TXT", "SRV", "NS"];
const EMPTY: DomainDnsRecordInput = { type: "A", host: "", answer: "", ttl: 300 };
const FORWARD_TYPES: DomainForward["type"][] = ["redirect", "302", "masked"];
const selectClass = "border-input bg-background h-8 rounded-md border px-2 text-xs";

/**
 * One domain's management panel on Settings → Domains (plan 22 §3.4–§3.6), everything the VCaaS API
 * already serves: the DNS records (the ones Totalum writes for an attached project are shown locked —
 * the API refuses them with `DNS_RECORD_MANAGED`), URL forwarding (the whole set saved at once),
 * renew now (a card charge, then one year at the registrar) and the transfer code (shown once, also
 * e-mailed; refused by the API during ICANN's 60-day lock).
 */
export function DomainManager({ domain, onChanged }: { domain: AccountDomain; onChanged: (updated?: AccountDomain) => void }) {
    const t = useT();
    const { locale } = useLocale();
    const id = domain.id;
    const [records, setRecords] = React.useState<DomainDnsRecord[] | null>(null);
    const [draft, setDraft] = React.useState<DomainDnsRecordInput>(EMPTY);
    const [editing, setEditing] = React.useState<string | null>(null);
    const [forwards, setForwards] = React.useState<DomainForward[]>([]);
    const [renewing, setRenewing] = React.useState(false);
    const [exporting, setExporting] = React.useState(false);
    const [authCode, setAuthCode] = React.useState<string | null>(null);

    const fail = (error?: string) => {
        toast.error(error || t("engineV2.common.failed"));
    };
    const load = React.useCallback(async () => {
        const [dns, fwd] = await Promise.all([vcaasApi.v2.dnsRecords(id), vcaasApi.v2.domainForwarding(id)]);
        setRecords(dns.ok ? dns.data?.records ?? [] : []);
        setForwards(fwd.ok ? fwd.data?.forwarding ?? [] : []);
    }, [id]);
    React.useEffect(() => {
        void load();
    }, [load]);

    const saveRecord = async () => {
        const record = { ...draft, ttl: Number(draft.ttl) || 300, priority: draft.priority === undefined ? undefined : Number(draft.priority) };
        const response = editing
            ? await vcaasApi.v2.updateDnsRecord(id, editing, record)
            : await vcaasApi.v2.createDnsRecord(id, record);
        if (!response.ok) return fail(response.error);
        toast.success(t("engineV2.domains.recordSaved"));
        setDraft(EMPTY);
        setEditing(null);
        void load();
    };
    const removeRecord = async (recordId: string) => {
        const response = await vcaasApi.v2.deleteDnsRecord(id, recordId);
        if (!response.ok) return fail(response.error);
        void load();
    };
    const saveForwards = async (next: DomainForward[]) => {
        const response = await vcaasApi.v2.setDomainForwarding(id, next.filter(f => f.host.trim() && f.forwardsTo.trim()));
        if (!response.ok) return fail(response.error);
        toast.success(t("engineV2.domains.forwardingSaved"));
        setForwards(response.data?.forwarding ?? []);
    };
    const renew = async () => {
        const response = await vcaasApi.v2.renewDomain(id);
        setRenewing(false);
        if (!response.ok) return fail(response.error);
        toast.success(t("engineV2.domains.renewed", { domain: domain.domain }));
        // the renew answer carries the new expiry: applied as is, no second list read (reads after a renew are consistent, dom2)
        onChanged(response.data?.domain);
    };
    const exportCode = async () => {
        const response = await vcaasApi.v2.exportDomain(id);
        setExporting(false);
        if (!response.ok || !response.data?.authCode) return fail(response.error);
        setAuthCode(response.data.authCode);
        onChanged();
    };
    const cancelExport = async () => {
        const response = await vcaasApi.v2.cancelDomainExport(id);
        if (!response.ok) return fail(response.error);
        setAuthCode(null);
        onChanged();
    };

    const locked = domain.exportAvailableAt ? Date.parse(domain.exportAvailableAt) > Date.now() : false;
    const needsPriority = draft.type === "MX" || draft.type === "SRV";

    return (
        <div className="bg-muted/30 w-full space-y-6 rounded-lg p-4" data-testid={`domain-manager-${domain.domain}`}>
            <section className="space-y-2">
                <h3 className="text-sm font-medium">{t("engineV2.domains.dnsTitle")}</h3>
                <table className="w-full text-left text-xs">
                    <thead className="text-muted-foreground">
                        <tr>
                            <th className="py-1 pr-2 font-normal">{t("engineV2.domains.recordType")}</th>
                            <th className="py-1 pr-2 font-normal">{t("engineV2.domains.recordHost")}</th>
                            <th className="py-1 pr-2 font-normal">{t("engineV2.domains.recordAnswer")}</th>
                            <th className="py-1 pr-2 font-normal">TTL</th>
                            <th className="py-1 font-normal" />
                        </tr>
                    </thead>
                    <tbody>
                        {(records ?? []).map(record => (
                            <tr key={record.id} className="border-border border-t">
                                <td className="py-1.5 pr-2 font-mono">{record.type}</td>
                                <td className="py-1.5 pr-2 font-mono">{record.host || "@"}</td>
                                <td className="py-1.5 pr-2 font-mono break-all">
                                    {record.priority !== undefined ? `${record.priority} ` : ""}
                                    {record.answer}
                                </td>
                                <td className="py-1.5 pr-2">{record.ttl}</td>
                                <td className="py-1.5 text-right whitespace-nowrap">
                                    {record.managed ? (
                                        <span className="text-muted-foreground inline-flex items-center gap-1" title={t("engineV2.domains.managedHint")}>
                                            <LockIcon className="size-3" aria-hidden />
                                            {t("engineV2.domains.managed")}
                                        </span>
                                    ) : (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                aria-label={t("engineV2.domains.editRecord")}
                                                onClick={() => {
                                                    setEditing(record.id);
                                                    setDraft({ type: record.type, host: record.host, answer: record.answer, ttl: record.ttl, priority: record.priority });
                                                }}
                                            >
                                                <PencilIcon className="size-3.5" aria-hidden />
                                            </Button>
                                            <Button size="sm" variant="ghost" aria-label={t("engineV2.domains.deleteRecord")} onClick={() => void removeRecord(record.id)}>
                                                <Trash2Icon className="size-3.5" aria-hidden />
                                            </Button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {records?.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-muted-foreground py-1.5">
                                    {t("engineV2.domains.noRecords")}
                                </td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        className={selectClass}
                        aria-label={t("engineV2.domains.recordType")}
                        value={draft.type}
                        onChange={event => setDraft(current => ({ ...current, type: event.target.value as DomainDnsRecordInput["type"] }))}
                    >
                        {TYPES.map(type => (
                            <option key={type}>{type}</option>
                        ))}
                    </select>
                    <Input className="h-8 w-36 text-xs" placeholder={t("engineV2.domains.recordHostPlaceholder")} value={draft.host} onChange={event => setDraft(current => ({ ...current, host: event.target.value }))} />
                    <Input className="h-8 min-w-40 flex-1 text-xs" placeholder={t("engineV2.domains.recordAnswer")} value={draft.answer} onChange={event => setDraft(current => ({ ...current, answer: event.target.value }))} />
                    {needsPriority ? (
                        <Input className="h-8 w-20 text-xs" type="number" placeholder={t("engineV2.domains.recordPriority")} value={draft.priority ?? ""} onChange={event => setDraft(current => ({ ...current, priority: event.target.value === "" ? undefined : Number(event.target.value) }))} />
                    ) : null}
                    <Input className="h-8 w-20 text-xs" type="number" min={300} aria-label="TTL" value={draft.ttl} onChange={event => setDraft(current => ({ ...current, ttl: Number(event.target.value) }))} />
                    <Button size="sm" onClick={() => void saveRecord()} disabled={!draft.answer.trim() || (needsPriority && draft.priority === undefined)}>
                        {editing ? t("engineV2.domains.saveRecord") : (
                            <>
                                <PlusIcon className="size-3.5" aria-hidden />
                                {t("engineV2.domains.addRecord")}
                            </>
                        )}
                    </Button>
                    {editing ? (
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setDraft(EMPTY); }}>
                            {t("engineV2.domains.cancel")}
                        </Button>
                    ) : null}
                </div>
            </section>

            <section className="space-y-2">
                <h3 className="text-sm font-medium">{t("engineV2.domains.forwardingTitle")}</h3>
                <p className="text-muted-foreground text-xs">{t("engineV2.domains.forwardingHint", { domain: domain.domain })}</p>
                {forwards.map((forward, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                        <Input className="h-8 w-36 text-xs" placeholder={t("engineV2.domains.recordHostPlaceholder")} value={forward.host} onChange={event => setForwards(list => list.map((f, i) => (i === index ? { ...f, host: event.target.value } : f)))} />
                        <span className="text-muted-foreground text-xs">→</span>
                        <Input className="h-8 min-w-40 flex-1 text-xs" placeholder="https://" value={forward.forwardsTo} onChange={event => setForwards(list => list.map((f, i) => (i === index ? { ...f, forwardsTo: event.target.value } : f)))} />
                        <select className={selectClass} aria-label={t("engineV2.domains.forwardType")} value={forward.type} onChange={event => setForwards(list => list.map((f, i) => (i === index ? { ...f, type: event.target.value as DomainForward["type"] } : f)))}>
                            {FORWARD_TYPES.map(type => (
                                <option key={type} value={type}>
                                    {t(`engineV2.domains.forward_${type}`)}
                                </option>
                            ))}
                        </select>
                        <Button size="sm" variant="ghost" aria-label={t("engineV2.domains.deleteRecord")} onClick={() => setForwards(list => list.filter((_, i) => i !== index))}>
                            <Trash2Icon className="size-3.5" aria-hidden />
                        </Button>
                    </div>
                ))}
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setForwards(list => [...list, { host: "", forwardsTo: "", type: "redirect" }])}>
                        <PlusIcon className="size-3.5" aria-hidden />
                        {t("engineV2.domains.addForward")}
                    </Button>
                    <Button size="sm" onClick={() => void saveForwards(forwards)}>
                        {t("engineV2.domains.saveForwarding")}
                    </Button>
                </div>
            </section>

            <section className="flex flex-wrap items-start gap-6">
                <div className="space-y-1.5">
                    <h3 className="text-sm font-medium">{t("engineV2.domains.renewTitle")}</h3>
                    <p className="text-muted-foreground text-xs">{t("engineV2.domains.expires", { date: formatDate(domain.expiresAt, locale) })}</p>
                    <Button size="sm" variant="outline" onClick={() => setRenewing(true)}>
                        {t("engineV2.domains.renewNow")}
                    </Button>
                </div>
                <div className="space-y-1.5">
                    <h3 className="text-sm font-medium">{t("engineV2.domains.exportTitle")}</h3>
                    <p className="text-muted-foreground text-xs">
                        {locked && domain.exportAvailableAt
                            ? t("engineV2.domains.exportLocked", { date: formatDate(domain.exportAvailableAt, locale) })
                            : t("engineV2.domains.exportHint")}
                    </p>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={locked} onClick={() => setExporting(true)}>
                            {t("engineV2.domains.exportCode")}
                        </Button>
                        {domain.status === "export_pending" ? (
                            <Button size="sm" variant="ghost" onClick={() => void cancelExport()}>
                                {t("engineV2.domains.cancelExport")}
                            </Button>
                        ) : null}
                    </div>
                    {authCode ? (
                        <div className="flex items-center gap-2">
                            <code className="bg-background rounded border px-2 py-1 text-sm" data-testid="domain-auth-code">
                                {authCode}
                            </code>
                            <Button size="sm" variant="ghost" aria-label={t("engineV2.domains.copy")} onClick={() => void navigator.clipboard.writeText(authCode)}>
                                <CopyIcon className="size-3.5" aria-hidden />
                            </Button>
                            <span className="text-muted-foreground text-xs">{t("engineV2.domains.codeOnce")}</span>
                        </div>
                    ) : null}
                </div>
            </section>

            <ConfirmDialog
                open={renewing}
                onOpenChange={setRenewing}
                title={t("engineV2.domains.renewConfirmTitle", { domain: domain.domain })}
                description={t("engineV2.domains.renewConfirmBody")}
                confirmLabel={t("engineV2.domains.renewNow")}
                onConfirm={renew}
            />
            <ConfirmDialog
                open={exporting}
                onOpenChange={setExporting}
                title={t("engineV2.domains.exportConfirmTitle", { domain: domain.domain })}
                description={t("engineV2.domains.exportConfirmBody")}
                confirmLabel={t("engineV2.domains.exportCode")}
                onConfirm={exportCode}
            />
        </div>
    );
}
