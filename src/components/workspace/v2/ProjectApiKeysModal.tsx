"use client";

import * as React from "react";
import { AppWindowIcon, CopyIcon, DownloadIcon, FileKey2Icon, KeyRoundIcon, LinkIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { ConfirmDialog, CopyButton, Modal, SpinnerBlock, StatusPill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale, useT } from "@/i18n";
import { formatDate, formatRelativeDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import type { ProjectApiKey } from "@/lib/vcaas-types";
import { SCOPE_PRESETS, keyKind, presetOf, type ScopePreset } from "@/lib/v2-pages";
import { Callout, Card, Disclosure } from "./page-bits";

const SCOPES = ["db:read", "db:write", "db:schema", "integrations:*"] as const;
const KIND_ICON = { app: <AppWindowIcon />, env: <FileKey2Icon />, custom: <KeyRoundIcon /> } as const;
const SELECT = "border-input bg-background h-9 w-full rounded-md border px-2 text-sm";

/**
 * Project API keys (`tlm_pk_`, A6.1; plan 15 §4.4) — not the account keys of `/api` (`tlm_sk_`). Three kinds, each
 * explained where it is listed: the app key (Totalum puts it in the app; rotating it swaps it with no downtime), the
 * `.env` key (inside the downloaded env files) and the owner's own keys. The plaintext is shown once, on create or
 * rotate; every rotate and revoke says its consequence before it runs. The preview address (A10.15) lives here too.
 */
export function ProjectApiKeysModal({
    open,
    onOpenChange,
    projectId,
    previewUrl,
    onPreviewRotated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    /** `preview.temporalLinkUrl` (A10.6); A10.15 rotates it here and every month. */
    previewUrl?: string | null;
    /** Re-read the project, so the embedded preview moves to the new address. */
    onPreviewRotated?: () => void;
}) {
    const t = useT();
    const { locale } = useLocale();
    const [keys, setKeys] = React.useState<ProjectApiKey[] | null>(null);
    const [creating, setCreating] = React.useState(false);
    const [plaintext, setPlaintext] = React.useState<{ name: string; value: string } | null>(null);
    const [revoking, setRevoking] = React.useState<ProjectApiKey | null>(null);
    const [rotating, setRotating] = React.useState<ProjectApiKey | null>(null);
    const [rotatingPreview, setRotatingPreview] = React.useState(false);

    const load = React.useCallback(async () => {
        const response = await vcaasApi.v2.apiKeys(projectId);
        setKeys(response.ok ? (response.data?.keys ?? []) : []);
    }, [projectId]);

    React.useEffect(() => {
        if (open) void load();
        else {
            setPlaintext(null);
            setCreating(false);
        }
    }, [open, load]);

    /** The environment's `.env` text, never rendered: to the clipboard or saved as a file. */
    const envText = async (env: "dev" | "live") => {
        const response = await fetch(`/api/vcaas/env/${encodeURIComponent(projectId)}?env=${env}`, { cache: "no-store" });
        if (response.ok && (response.headers.get("content-type") || "").startsWith("text/plain")) return response.text();
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error || t("engineV2.common.failed"));
        return null;
    };
    const copyEnv = async (env: "dev" | "live") => {
        const text = await envText(env);
        if (text === null) return;
        await navigator.clipboard.writeText(text);
        toast.success(t("engineV2.apiKeys.envCopied"));
    };
    const downloadEnv = async (env: "dev" | "live") => {
        const text = await envText(env);
        if (text === null) return;
        const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
        const link = Object.assign(document.createElement("a"), { href: url, download: env === "dev" ? ".env" : ".env.prod" });
        link.click();
        URL.revokeObjectURL(url);
        toast.success(t("engineV2.apiKeys.envDownloaded"));
    };

    const reveal = (name: string, response: Awaited<ReturnType<typeof vcaasApi.v2.createApiKey>>) => {
        if (response.ok && response.data?.key.plaintext) setPlaintext({ name, value: response.data.key.plaintext });
        else toast.error(response.error || t("engineV2.common.failed"));
        void load();
        return response.ok;
    };

    const active = (keys ?? []).filter(key => !key.revokedAt);
    const revoked = (keys ?? []).filter(key => key.revokedAt);
    const rotateKind = rotating ? keyKind(rotating) : "custom";

    return (
        <Modal open={open} onOpenChange={onOpenChange} size="lg" title={t("engineV2.apiKeys.title")} description={t("engineV2.apiKeys.intro")}>
            <div className="space-y-5">
                {plaintext ? (
                    <Callout tone="warning" title={t("engineV2.apiKeys.storeNow", { name: plaintext.name })} testId="key-plaintext">
                        <div className="mt-1 flex items-center gap-2">
                            <code className="bg-background/70 min-w-0 flex-1 truncate rounded px-2 py-1 font-mono text-xs">{plaintext.value}</code>
                            <CopyButton value={plaintext.value} size="sm" />
                        </div>
                    </Callout>
                ) : null}

                {/* ── The keys ─────────────────────────────────────────── */}
                <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-semibold">{t("engineV2.apiKeys.keysTitle")}</h3>
                        {!creating ? (
                            <Button size="sm" onClick={() => setCreating(true)}>
                                <PlusIcon className="size-4" aria-hidden />
                                {t("engineV2.apiKeys.create")}
                            </Button>
                        ) : null}
                    </div>
                    {keys === null ? (
                        <SpinnerBlock />
                    ) : (
                        <ul className="space-y-2">
                            {active.map(key => {
                                const kind = keyKind(key);
                                return (
                                    <li key={key.id} className="border-border bg-card flex flex-wrap items-start gap-3 rounded-xl border p-3" data-testid={`key-${kind}`}>
                                        <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5" aria-hidden>
                                            {KIND_ICON[kind]}
                                        </span>
                                        <div className="min-w-0 flex-1 basis-56">
                                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                                {kind === "custom" ? key.name : t(`engineV2.apiKeys.kind_${kind}`)}
                                                {kind !== "custom" ? <StatusPill tone="info">{t("engineV2.apiKeys.managedBadge")}</StatusPill> : null}
                                                <StatusPill tone="neutral">{t(`engineV2.apiKeys.where_${key.env}`)}</StatusPill>
                                            </p>
                                            <p className="text-muted-foreground text-[13px]">{t(`engineV2.apiKeys.kindHint_${kind}`)}</p>
                                            <p className="text-muted-foreground mt-1 font-mono text-xs">
                                                {key.prefix ?? "tlm_pk_"}…{key.last4 ?? ""}
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                {t("engineV2.apiKeys.created", { date: formatDate(key.createdAt, locale) })}
                                                {key.lastUsedAt ? ` · ${t("engineV2.apiKeys.lastUsed", { when: formatRelativeDate(key.lastUsedAt, locale) })}` : ""}
                                                {kind === "custom" ? ` · ${t(`engineV2.apiKeys.preset_${presetOf(key.scopes)}`)}` : ""}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button size="sm" variant="outline" onClick={() => setRotating(key)}>
                                                <RefreshCwIcon className="size-3.5" aria-hidden />
                                                {t("engineV2.apiKeys.rotate")}
                                            </Button>
                                            {kind === "custom" ? (
                                                <Button size="icon" variant="ghost" aria-label={t("engineV2.apiKeys.revokeFor", { name: key.name })} onClick={() => setRevoking(key)}>
                                                    <Trash2Icon className="size-4" aria-hidden />
                                                </Button>
                                            ) : null}
                                        </div>
                                    </li>
                                );
                            })}
                            {active.every(key => key.managed) && !creating ? (
                                <li className="border-border text-muted-foreground rounded-xl border border-dashed p-3 text-[13px]">{t("engineV2.apiKeys.noCustom")}</li>
                            ) : null}
                        </ul>
                    )}
                    {revoked.length ? (
                        <Disclosure title={t("engineV2.apiKeys.revokedTitle", { count: revoked.length })}>
                            <ul className="space-y-1 text-xs">
                                {revoked.map(key => (
                                    <li key={key.id} className="text-muted-foreground">
                                        <span className="line-through">{key.name}</span> <span className="font-mono">{key.prefix ?? "tlm_pk_"}…</span> ·{" "}
                                        {t("engineV2.apiKeys.revokedOn", { date: formatDate(key.revokedAt, locale) })}
                                    </li>
                                ))}
                            </ul>
                        </Disclosure>
                    ) : null}
                </section>

                {creating ? (
                    <NewKeyForm
                        onCancel={() => setCreating(false)}
                        onCreate={async body => {
                            if (reveal(body.name, await vcaasApi.v2.createApiKey(projectId, body))) setCreating(false);
                        }}
                    />
                ) : null}

                {/* ── Run it on your computer ──────────────────────────── */}
                <Card title={t("engineV2.apiKeys.envFiles")} description={t("engineV2.apiKeys.envFilesHint")} icon={<FileKey2Icon />} testId="env-files">
                    <div className="grid gap-2 sm:grid-cols-2">
                        {(["dev", "live"] as const).map(env => (
                            <div key={env} className="border-border space-y-2 rounded-lg border p-3">
                                <p className="text-sm font-medium">{t(env === "dev" ? "engineV2.apiKeys.envDevTitle" : "engineV2.apiKeys.envLiveTitle")}</p>
                                <p className="text-muted-foreground text-xs">{t(env === "dev" ? "engineV2.apiKeys.envDevHint" : "engineV2.apiKeys.envLiveHint")}</p>
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" onClick={() => void downloadEnv(env)}>
                                        <DownloadIcon className="size-4" aria-hidden />
                                        {t(env === "dev" ? "engineV2.apiKeys.downloadEnvDev" : "engineV2.apiKeys.downloadEnvLive")}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => void copyEnv(env)}>
                                        <CopyIcon className="size-4" aria-hidden />
                                        {t("engineV2.apiKeys.copy")}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Disclosure title={t("engineV2.apiKeys.howToUse")}>
                        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-[13px]">
                            <li>{t("engineV2.apiKeys.step1")}</li>
                            <li>{t("engineV2.apiKeys.step2")}</li>
                            <li>{t("engineV2.apiKeys.step3")}</li>
                        </ol>
                        <p className="text-muted-foreground text-xs">{t("engineV2.apiKeys.hint")}</p>
                    </Disclosure>
                </Card>

                {/* ── Preview address ─────────────────────────────────── */}
                {previewUrl ? (
                    <Card title={t("engineV2.apiKeys.previewTitle")} description={t("engineV2.apiKeys.previewHint")} icon={<LinkIcon />} testId="preview-card">
                        <div className="flex items-center gap-2">
                            <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 font-mono text-xs" data-testid="preview-address">
                                {previewUrl}
                            </code>
                            <CopyButton value={previewUrl} size="sm" />
                        </div>
                        <div className="flex justify-end">
                            <Button size="sm" variant="outline" onClick={() => setRotatingPreview(true)}>
                                <RefreshCwIcon className="size-4" aria-hidden />
                                {t("engineV2.apiKeys.previewRotate")}
                            </Button>
                        </div>
                    </Card>
                ) : null}
            </div>

            <ConfirmDialog
                open={rotatingPreview}
                onOpenChange={setRotatingPreview}
                title={t("engineV2.apiKeys.previewRotateTitle")}
                description={t("engineV2.apiKeys.previewRotateBody")}
                confirmLabel={t("engineV2.apiKeys.previewRotate")}
                onConfirm={async () => {
                    const response = await vcaasApi.v2.rotatePreviewUrl(projectId);
                    setRotatingPreview(false);
                    if (!response.ok) {
                        toast.error(response.error || t("engineV2.common.failed"));
                        return;
                    }
                    toast.success(t("engineV2.apiKeys.previewRotated"));
                    onPreviewRotated?.();
                }}
            />
            <ConfirmDialog
                open={rotating !== null}
                onOpenChange={value => !value && setRotating(null)}
                tone={rotateKind === "app" ? "default" : "danger"}
                title={t(`engineV2.apiKeys.rotateTitle_${rotateKind}`, { name: rotating?.name ?? "" })}
                description={t(`engineV2.apiKeys.rotateBody_${rotateKind}`)}
                confirmLabel={t("engineV2.apiKeys.rotate")}
                onConfirm={async () => {
                    if (!rotating) return;
                    const name = keyKind(rotating) === "custom" ? rotating.name : t(`engineV2.apiKeys.kind_${keyKind(rotating)}`);
                    reveal(name, await vcaasApi.v2.rotateApiKey(projectId, rotating.id));
                    setRotating(null);
                }}
            />
            <ConfirmDialog
                open={revoking !== null}
                onOpenChange={value => !value && setRevoking(null)}
                tone="danger"
                title={t("engineV2.apiKeys.revokeTitle", { name: revoking?.name ?? "" })}
                description={t("engineV2.apiKeys.revokeBody")}
                confirmLabel={t("engineV2.apiKeys.revoke")}
                onConfirm={async () => {
                    if (!revoking) return;
                    const response = await vcaasApi.v2.revokeApiKey(projectId, revoking.id);
                    if (!response.ok) toast.error(response.error || t("engineV2.common.failed"));
                    else toast.success(t("engineV2.apiKeys.revoked"));
                    setRevoking(null);
                    void load();
                }}
            />
        </Modal>
    );
}

function NewKeyForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: (body: { name: string; scopes: string[]; env: ProjectApiKey["env"] }) => Promise<void> }) {
    const t = useT();
    const [name, setName] = React.useState("");
    const [env, setEnv] = React.useState<ProjectApiKey["env"]>("both");
    const [scopes, setScopes] = React.useState<string[]>([...SCOPE_PRESETS.readWrite]);
    const [saving, setSaving] = React.useState(false);
    const preset = presetOf(scopes);

    return (
        <Card title={t("engineV2.apiKeys.newTitle")} description={t("engineV2.apiKeys.newHint")} testId="key-new">
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs">
                    <span className="font-medium">{t("engineV2.apiKeys.name")}</span>
                    <Input placeholder={t("engineV2.apiKeys.namePlaceholder")} value={name} onChange={e => setName(e.target.value)} />
                </label>
                <label className="space-y-1 text-xs">
                    <span className="font-medium">{t("engineV2.apiKeys.env")}</span>
                    <select className={SELECT} value={env} onChange={e => setEnv(e.target.value as ProjectApiKey["env"])}>
                        {(["both", "live", "dev"] as const).map(value => (
                            <option key={value} value={value}>
                                {t(`engineV2.apiKeys.where_${value}`)}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <fieldset className="space-y-1.5">
                <legend className="mb-1 text-xs font-medium">{t("engineV2.apiKeys.canDo")}</legend>
                {(Object.keys(SCOPE_PRESETS) as (keyof typeof SCOPE_PRESETS)[]).map(value => (
                    <label key={value} className="border-border has-[:checked]:border-primary has-[:checked]:bg-primary/5 flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm">
                        <input type="radio" name="key-preset" className="mt-1" checked={preset === value} onChange={() => setScopes([...SCOPE_PRESETS[value]])} />
                        <span>
                            <span className="font-medium">{t(`engineV2.apiKeys.preset_${value}`)}</span>
                            <span className="text-muted-foreground block text-xs">{t(`engineV2.apiKeys.presetHint_${value}`)}</span>
                        </span>
                    </label>
                ))}
            </fieldset>
            {scopes.includes("db:schema") ? <Callout tone="warning">{t("engineV2.apiKeys.schemaWarning")}</Callout> : null}
            <Disclosure title={t("engineV2.apiKeys.customScopes")} hint={preset === ("custom" as ScopePreset) ? t("engineV2.apiKeys.preset_custom") : undefined}>
                <div className="flex flex-wrap gap-3 text-xs">
                    {SCOPES.map(scope => (
                        <label key={scope} className="flex items-center gap-1.5">
                            <input
                                type="checkbox"
                                checked={scopes.includes(scope)}
                                onChange={e => setScopes(current => (e.target.checked ? [...current, scope] : current.filter(s => s !== scope)))}
                            />
                            <span className="font-mono">{scope}</span>
                        </label>
                    ))}
                </div>
            </Disclosure>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onCancel}>
                    {t("common.cancel")}
                </Button>
                <Button
                    disabled={saving || !name.trim() || scopes.length === 0}
                    onClick={async () => {
                        setSaving(true);
                        await onCreate({ name: name.trim(), scopes, env });
                        setSaving(false);
                    }}
                >
                    {t("engineV2.apiKeys.createConfirm")}
                </Button>
            </div>
        </Card>
    );
}
