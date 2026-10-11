"use client";

import * as React from "react";
import { BotIcon, GlobeIcon, LoaderIcon, PauseCircleIcon, PlugIcon, Trash2Icon } from "lucide-react";
import { ConfirmDialog, StatusPill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n";
import { usePrice } from "@/components/credits/CreditsProvider";
import { toast } from "@/lib/toast";
import { vcaasApi, type McpServerDraft } from "@/lib/vcaas";
import type { McpServer, VcaasProject } from "@/lib/vcaas-types";

const SYSTEM_PROMPT_MAX = 20_000;
const EMPTY_MCP: McpServerDraft & { headerName: string; headerValue: string } = {
    name: "",
    transport: "http",
    url: "",
    headerName: "",
    headerValue: "",
};

/**
 * Project settings sections that exist only for v2 projects (plan 15 G8, G34, G49): the agent's
 * system prompt and custom MCP servers, the live address, and the Pause card. Mounted by
 * `ProjectSettingsModal` behind `isV2Project`, so a legacy project never renders any of it.
 */
export function V2ProjectSettings({ project, onChanged }: { project: VcaasProject; onChanged: () => void }) {
    return (
        <>
            <AgentSection projectId={project.projectId} />
            <LiveAddressSection project={project} onChanged={onChanged} />
            <PauseSection project={project} onChanged={onChanged} />
        </>
    );
}

function SectionTitle({ icon: Icon, title, description }: { icon: typeof BotIcon; title: string; description?: string }) {
    return (
        <div>
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <Icon className="text-muted-foreground size-4" aria-hidden />
                {title}
            </h3>
            {description ? <p className="text-muted-foreground mt-0.5 text-xs">{description}</p> : null}
        </div>
    );
}

function AgentSection({ projectId }: { projectId: string }) {
    const t = useT();
    const [prompt, setPrompt] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [servers, setServers] = React.useState<McpServer[] | null>(null);
    const [draft, setDraft] = React.useState(EMPTY_MCP);
    const [verified, setVerified] = React.useState<string[] | null>(null);
    const [busy, setBusy] = React.useState(false);

    const loadServers = React.useCallback(async () => {
        const response = await vcaasApi.v2.mcpServers(projectId);
        setServers(response.ok ? response.data?.servers ?? [] : []);
    }, [projectId]);

    React.useEffect(() => {
        void vcaasApi.v2.systemPrompt(projectId).then(response => setPrompt(response.ok ? response.data?.systemPrompt ?? "" : ""));
        void loadServers();
    }, [projectId, loadServers]);

    const mcp = (): McpServerDraft => ({
        name: draft.name.trim(),
        transport: draft.transport,
        url: draft.url.trim(),
        ...(draft.headerName.trim() ? { headers: { [draft.headerName.trim()]: draft.headerValue } } : {}),
    });

    const edit = (patch: Partial<typeof draft>) => {
        setDraft(current => ({ ...current, ...patch }));
        setVerified(null); // Save needs a successful verify of exactly what is typed (A5.7).
    };

    const verify = async () => {
        setBusy(true);
        const response = await vcaasApi.v2.verifyMcpServer(projectId, mcp());
        setBusy(false);
        if (response.ok) setVerified(response.data?.tools.map(tool => tool.name) ?? []);
        else toast.error(response.error || t("engineV2.agent.verifyFailed"));
    };

    const add = async () => {
        setBusy(true);
        const response = await vcaasApi.v2.addMcpServer(projectId, mcp());
        setBusy(false);
        if (!response.ok) return void toast.error(response.error || t("engineV2.agent.verifyFailed"));
        setDraft(EMPTY_MCP);
        setVerified(null);
        void loadServers();
    };

    const savePrompt = async () => {
        setSaving(true);
        const response = await vcaasApi.v2.setSystemPrompt(projectId, prompt ?? "");
        setSaving(false);
        if (response.ok) toast.success(t("common.saved"));
        else toast.error(response.error || t("engineV2.common.failed"));
    };

    return (
        <section className="border-border space-y-3 border-t pt-5">
            <SectionTitle icon={BotIcon} title={t("engineV2.agent.title")} description={t("engineV2.agent.systemPromptHint")} />
            <Textarea
                value={prompt ?? ""}
                disabled={prompt === null}
                maxLength={SYSTEM_PROMPT_MAX}
                onChange={event => setPrompt(event.target.value)}
                rows={4}
                aria-label={t("engineV2.agent.systemPrompt")}
                placeholder={t("engineV2.agent.systemPrompt")}
            />
            <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                    {(prompt ?? "").length.toLocaleString()} / {SYSTEM_PROMPT_MAX.toLocaleString()}
                </span>
                <Button size="sm" onClick={() => void savePrompt()} disabled={prompt === null || saving}>
                    {saving ? t("common.saving") : t("common.save")}
                </Button>
            </div>

            <SectionTitle icon={PlugIcon} title={t("engineV2.agent.mcpTitle")} description={t("engineV2.agent.mcpHint")} />
            <ul className="space-y-1.5">
                {(servers ?? []).map(server => (
                    <li key={server.id} className="border-border flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium">{server.name}</span>{" "}
                            <span className="text-muted-foreground text-xs">{server.url} · {t("engineV2.agent.toolCount", { count: server.tools.length })}</span>
                        </span>
                        <Switch
                            checked={server.enabled}
                            aria-label={t("engineV2.agent.enabled")}
                            onCheckedChange={async enabled => {
                                await vcaasApi.v2.setMcpServerEnabled(projectId, server.id, enabled);
                                void loadServers();
                            }}
                        />
                        <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t("common.delete")}
                            onClick={async () => {
                                await vcaasApi.v2.removeMcpServer(projectId, server.id);
                                void loadServers();
                            }}
                        >
                            <Trash2Icon className="size-4" aria-hidden />
                        </Button>
                    </li>
                ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder={t("engineV2.agent.mcpName")} value={draft.name} onChange={e => edit({ name: e.target.value })} />
                <select
                    className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                    value={draft.transport}
                    onChange={e => edit({ transport: e.target.value as "http" | "sse" })}
                    aria-label={t("engineV2.agent.mcpTransport")}
                >
                    <option value="http">HTTP</option>
                    <option value="sse">SSE</option>
                </select>
                <Input className="sm:col-span-2" placeholder="https://…" value={draft.url} onChange={e => edit({ url: e.target.value })} />
                <Input placeholder={t("engineV2.agent.mcpHeaderName")} value={draft.headerName} onChange={e => edit({ headerName: e.target.value })} />
                <Input type="password" placeholder={t("engineV2.agent.mcpHeaderValue")} value={draft.headerValue} onChange={e => edit({ headerValue: e.target.value })} />
            </div>
            <div className="flex items-center justify-end gap-2">
                {verified ? <StatusPill tone="success">{t("engineV2.agent.verified", { count: verified.length })}</StatusPill> : null}
                <Button size="sm" variant="outline" disabled={busy || !draft.name || !draft.url} onClick={() => void verify()}>
                    {busy ? <LoaderIcon className="size-3.5 animate-spin" aria-hidden /> : null}
                    {t("engineV2.agent.verify")}
                </Button>
                <Button size="sm" disabled={busy || !verified} onClick={() => void add()}>
                    {t("engineV2.agent.add")}
                </Button>
            </div>
        </section>
    );
}

function LiveAddressSection({ project, onChanged }: { project: VcaasProject; onChanged: () => void }) {
    const t = useT();
    const current = project.liveHostSuffix ?? "totalum-project.com";
    // Professional and Enterprise only. This app does not know the plan, so the choice is offered and the API's
    // refusal (`PLAN_REQUIRED`) is shown as the plan note.
    const choose = async (suffix: "totalum-project.com" | "webapp-project.com") => {
        if (suffix === current) return;
        const response = await vcaasApi.v2.setLiveHostSuffix(project.projectId, suffix);
        if (response.ok) onChanged();
        else toast.error(response.code === "PLAN_REQUIRED" ? t("engineV2.domains.planRequired") : response.error || t("engineV2.common.failed"));
    };
    return (
        <section className="border-border space-y-3 border-t pt-5">
            <SectionTitle icon={GlobeIcon} title={t("engineV2.domains.liveAddress")} description={t("engineV2.domains.liveAddressHint")} />
            <div className="flex flex-col gap-1.5 text-sm">
                {(["totalum-project.com", "webapp-project.com"] as const).map(suffix => (
                    <label key={suffix} className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="live-host-suffix"
                            checked={current === suffix}
                            onChange={() => void choose(suffix)}
                        />
                        <span className="font-mono text-xs">{project.projectId}.{suffix}</span>
                    </label>
                ))}
            </div>
        </section>
    );
}

function PauseSection({ project, onChanged }: { project: VcaasProject; onChanged: () => void }) {
    const t = useT();
    const price = usePrice();
    const [open, setOpen] = React.useState(false);
    const paused = project.state === "paused-by-user" || project.lifecycle?.state === "paused-by-user";
    // Disabled with the reason written next to it while a run, deploy or operation is in progress.
    const busyReason = project.currentRun
        ? t("engineV2.pause.busyRun")
        : project.busy || project.deployment?.status === "deploying"
          ? t("engineV2.pause.busyOperation")
          : null;
    if (paused) return null;

    return (
        <section className="border-border space-y-3 border-t pt-5">
            <SectionTitle icon={PauseCircleIcon} title={t("engineV2.pause.title")} description={t("engineV2.pause.lead", { price: price("PAUSE_RESUME", "v2") })} />
            <div className="grid gap-3 text-xs sm:grid-cols-2">
                <div>
                    <p className="mb-1 font-medium">{t("engineV2.pause.stopsTitle")}</p>
                    <ul className="text-muted-foreground list-disc space-y-0.5 pl-4">
                        {(["stops1", "stops2", "stops3", "stops4", "stops5", "stops6"] as const).map(key => (
                            <li key={key}>{t(`engineV2.pause.${key}`)}</li>
                        ))}
                    </ul>
                </div>
                <div>
                    <p className="mb-1 font-medium">{t("engineV2.pause.keptTitle")}</p>
                    <ul className="text-muted-foreground list-disc space-y-0.5 pl-4">
                        {(["kept1", "kept2", "kept3", "kept4", "kept5"] as const).map(key => (
                            <li key={key}>{t(`engineV2.pause.${key}`)}</li>
                        ))}
                    </ul>
                </div>
            </div>
            <p className="text-muted-foreground text-xs">{t("engineV2.pause.price", { price: price("PAUSE_RESUME", "v2") })} {t("engineV2.pause.noCountdown")}</p>
            <div className="flex items-center justify-end gap-3">
                {busyReason ? <span className="text-muted-foreground text-xs">{busyReason}</span> : null}
                <Button variant="outline" size="sm" disabled={!!busyReason} onClick={() => setOpen(true)}>
                    {t("engineV2.pause.confirm", { price: price("PAUSE_RESUME", "v2") })}
                </Button>
            </div>
            <ConfirmDialog
                open={open}
                onOpenChange={setOpen}
                tone="danger"
                title={t("engineV2.pause.title")}
                description={t("engineV2.pause.typeToConfirm", { projectId: project.projectId })}
                confirmPhrase={project.projectId}
                confirmLabel={t("engineV2.pause.confirm", { price: price("PAUSE_RESUME", "v2") })}
                onConfirm={async () => {
                    const response = await vcaasApi.v2.pause(project.projectId);
                    // PROJECT_ALREADY_PAUSED is the idempotent no-op (plan 15 §4.23).
                    if (response.ok || response.upstreamCode === "PROJECT_ALREADY_PAUSED") toast.success(t("engineV2.pause.started"));
                    else toast.error(response.upstreamCode === "AGENT_RUNNING" ? t("engineV2.pause.busyRun") : response.error || t("engineV2.common.failed"));
                    onChanged();
                }}
            />
        </section>
    );
}
