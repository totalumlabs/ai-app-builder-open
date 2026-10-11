"use client";

import * as React from "react";
import { AlertCircleIcon, ExternalLinkIcon, WandSparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import type { Translate } from "@/i18n";
import type { VcaasDeployError } from "@/lib/vcaas-types";

/** The prompt "Ask the AI to fix it" seeds (plan 15 §2.9) — the user edits or sends it. */
export function fixPrompt(t: Translate, error: VcaasDeployError): string {
    return t("engineV2.deployError.fixPrompt", { stage: error.stage, message: error.message });
}

/**
 * repairlive (A10.4): the publish was refused because a migration deletes or overwrites live rows and nobody confirmed
 * it. Answers the statement (from the engine's message), or null for any other failure.
 */
export function destructiveStatement(error: VcaasDeployError): string | null {
    if (!error.message.startsWith("DESTRUCTIVE_MIGRATION_NEEDS_CONFIRMATION")) return null;
    return /exists \(([\s\S]*)\) and (?:nobody confirmed it|needs your confirmation)/.exec(error.message)?.[1] ?? "";
}

/**
 * r2fix: a preview deploy (a code-editor save, a prompt) whose dev migration was refused because it deletes or
 * overwrites data nobody confirmed. Not a publish: the way forward is the AI (it confirms) or a confirmed publish.
 */
export const isDevDestructive = (error: VcaasDeployError) =>
    !error.message.startsWith("DESTRUCTIVE_MIGRATION_NEEDS_CONFIRMATION") && error.message.includes("DESTRUCTIVE_MIGRATION_NEEDS_CONFIRMATION");

/**
 * SP29: a failure of the platform, not of the app (Cloudflare reset an object mid-deploy, a deploy interrupted again
 * and again, an upload the network dropped). The user is told in plain words — never the internal message — and is
 * not offered "Ask the AI to fix it": there is nothing in their code to fix.
 */
const INFRA = /Durable Object|code was updated|Network connection lost|preview deploy was interrupted|UPLOAD_INFRA|internal error; reference/i;
export const isInfraError = (error: VcaasDeployError) => INFRA.test(error.message);
/**
 * SP29: a chat message whose text is a platform failure ("…: Durable Object reset…") said in plain words; B2-SW9: so is a
 * publish refused for an unconfirmed destructive migration (the banner above holds the statement and the confirm
 * button). Else null: the message is shown as it is.
 */
export const plainInfraMessage = (t: Translate, text: string): string | null =>
    INFRA.test(text)
        ? t("engineV2.deployError.infra")
        : text.includes("DESTRUCTIVE_MIGRATION_NEEDS_CONFIRMATION")
          ? t("engineV2.deployError.destructiveChat")
          : null;

/** The statement and "Publish anyway (I confirm)": the same publish again with `confirmDestructive: true`. */
export function ConfirmDestructive({ statement, onConfirm }: { statement: string; onConfirm: () => void }) {
    const t = useT();
    const [sent, setSent] = React.useState(false);
    return (
        <div className="w-full space-y-1.5 text-xs">
            <p>{t("engineV2.deployError.destructive")}</p>
            {statement ? (
                <pre className="bg-background/60 text-foreground overflow-auto rounded p-2 font-mono whitespace-pre-wrap">{statement}</pre>
            ) : null}
            <Button
                size="sm"
                variant="destructive"
                disabled={sent}
                onClick={() => {
                    setSent(true);
                    onConfirm();
                }}
            >
                {t("engineV2.deployError.publishAnyway")}
            </Button>
        </div>
    );
}

/**
 * The red `deploy_error` chat card (A5.14/A5.21): stage, title, the agent's fix summary when
 * present, the VERBATIM error, a collapsed log excerpt, the full log and the fix seed.
 */
export function DeployErrorCard({ error, onAskFix }: { error: VcaasDeployError; onAskFix?: (prompt: string) => void }) {
    const t = useT();
    if (isInfraError(error))
        return (
            <div role="alert" className="border-destructive/40 bg-destructive-subtle text-destructive-subtle-foreground space-y-1 rounded-lg border p-3 text-sm">
                <p className="flex items-start gap-2 font-medium">
                    <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{error.title}</span>
                </p>
                <p className="text-xs">{t("engineV2.deployError.infra")}</p>
            </div>
        );
    return (
        <div role="alert" className="border-destructive/40 bg-destructive-subtle text-destructive-subtle-foreground space-y-2 rounded-lg border p-3 text-sm">
            <p className="flex items-start gap-2 font-medium">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                    <span className="bg-destructive/15 mr-2 rounded px-1.5 py-0.5 text-xs uppercase">{error.stage}</span>
                    {error.title}
                </span>
            </p>
            {error.fixSummary ? (
                <p className="text-xs">
                    {t("engineV2.deployError.fixSummary")} {error.fixSummary}
                </p>
            ) : null}
            {isDevDestructive(error) ? <p className="text-xs">{t("engineV2.deployError.devDestructive")}</p> : null}
            <pre className="bg-background/60 text-foreground max-h-48 overflow-auto rounded p-2 font-mono text-xs whitespace-pre-wrap">
                {error.message}
            </pre>
            {error.logExcerpt ? (
                <details className="text-xs">
                    <summary className="cursor-pointer">{t("engineV2.deployError.logExcerpt")}</summary>
                    <pre className="bg-background/60 text-foreground mt-1 max-h-64 overflow-auto rounded p-2 font-mono whitespace-pre-wrap">
                        {error.logExcerpt}
                    </pre>
                </details>
            ) : null}
            <div className="flex flex-wrap gap-2">
                {error.logsUrl ? (
                    <Button size="sm" variant="outline" asChild>
                        <a href={error.logsUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLinkIcon className="size-3.5" aria-hidden />
                            {t("engineV2.deployError.viewLog")}
                        </a>
                    </Button>
                ) : null}
                {onAskFix ? (
                    <Button size="sm" variant="outline" onClick={() => onAskFix(fixPrompt(t, error))}>
                        <WandSparklesIcon className="size-3.5" aria-hidden />
                        {t("engineV2.deployError.askFix")}
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
