"use client";

import * as React from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Modal } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import {
    TOTALUM_LIMIT_EVENT,
    TOTALUM_UPGRADE_URL,
    totalumLimitCopy,
    type TotalumLimit,
} from "@/lib/totalum-limit";

/**
 * ═══ THE TOTALUM ACCOUNT HIT A LIMIT — ONE MODAL, EVERY ENDPOINT ═══
 *
 * Out of Totalum credits, or the Totalum plan's project limit. It LISTENS for the event
 * `proxyRequest` raises (see `lib/totalum-limit.ts`) instead of being wired per call site,
 * and it never swallows the response: callers keep their own error text as a fallback.
 *
 * This builder runs on ONE Totalum API key, the operator's, so both limits are fixed on
 * Totalum: the button opens the Totalum plans page in a new tab.
 */
export function TotalumLimitModal() {
    const [limit, setLimit] = React.useState<TotalumLimit | null>(null);

    React.useEffect(() => {
        const onLimit = (event: Event) => setLimit((event as CustomEvent<TotalumLimit>).detail);
        window.addEventListener(TOTALUM_LIMIT_EVENT, onLimit);
        return () => window.removeEventListener(TOTALUM_LIMIT_EVENT, onLimit);
    }, []);

    const copy = limit ? totalumLimitCopy(limit) : null;

    return (
        <Modal
            open={limit !== null}
            onOpenChange={(open) => !open && setLimit(null)}
            size="sm"
            title={copy?.title ?? ""}
            description={copy?.description}
            footer={
                <>
                    <Button variant="outline" onClick={() => setLimit(null)}>
                        Close
                    </Button>
                    <Button asChild className="gap-2">
                        {/* A real anchor: a scripted pop-up from a dialog is what pop-up blockers refuse. */}
                        <a href={TOTALUM_UPGRADE_URL} target="_blank" rel="noopener noreferrer" data-testid="totalum-limit-upgrade">
                            {limit?.kind === "projects" ? "Upgrade Totalum plan" : "Buy credits or upgrade plan"}
                            <ExternalLinkIcon className="size-3.5 opacity-70" aria-hidden />
                        </a>
                    </Button>
                </>
            }
        >
            {copy?.usage ? <p className="text-sm font-medium" data-testid="totalum-limit-usage">{copy.usage}</p> : null}
            <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs leading-relaxed">
                Before you publish your project, tell the AI to remove this modal.
            </p>
        </Modal>
    );
}
