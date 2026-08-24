"use client";

import * as React from "react";
import { CreditCardIcon, ExternalLinkIcon } from "lucide-react";
import { Modal } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { INSUFFICIENT_CREDITS_EVENT } from "@/lib/vcaas";

/**
 * ═══⭐⭐ "YOU ARE OUT OF CREDITS" — ONE MODAL, EVERY ENDPOINT ═══════════════
 *
 * ⚠️⚠️ IT LISTENS RATHER THAN BEING CALLED, and that is the only version of this that
 * stays correct. Roughly forty `vcaasApi` methods can come back `INSUFFICIENT_CREDITS` —
 * a prompt, a publish, a rebuild, a file write, an export, an import, a visual edit — and
 * answering it at forty call sites means the forty-first forgets. `proxyRequest` is the
 * single chokepoint every one of them passes through, so it raises
 * `INSUFFICIENT_CREDITS_EVENT` once and this component answers it once.
 *
 * ⚠️ THE EVENT NEVER SWALLOWS THE RESPONSE. The caller still receives its refusal and
 * still handles it however it did before; this only adds the explanation on top.
 *
 * ── WHY THE LINK LEAVES THIS APP ────────────────────────────────────────────
 *
 * This builder runs on ONE Totalum API key — the operator's. There is no per-visitor
 * balance to top up here and no checkout to run: credits belong to the Totalum account
 * behind that key, so the only honest button is one that opens that account's billing
 * page. It deliberately opens in a new tab; whatever the user was building is still here
 * when they come back.
 */

/** Where credits are actually bought. The account behind `TOTALUM_VCAAS_API_KEY`. */
const BUY_CREDITS_URL = "https://platform.totalum.app/billing";

export function InsufficientCreditsModal() {
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        const onEmpty = () => setOpen(true);
        window.addEventListener(INSUFFICIENT_CREDITS_EVENT, onEmpty);
        return () => window.removeEventListener(INSUFFICIENT_CREDITS_EVENT, onEmpty);
    }, []);

    return (
        <Modal
            open={open}
            onOpenChange={setOpen}
            size="sm"
            title="You're out of credits"
            description="This action needs Totalum credits, and the account behind this app has none left. Top it up and try again — nothing you've built is lost."
            footer={
                <>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Close
                    </Button>
                    <Button asChild className="gap-2">
                        {/*
                          ⚠️ A REAL ANCHOR WITH `target="_blank"`, NOT A `window.open` HANDLER.
                          A scripted pop-up from inside a dialog is the exact shape pop-up
                          blockers refuse, and being refused here — at the one moment the user
                          has agreed to pay — is the worst possible place for it.
                        */}
                        <a href={BUY_CREDITS_URL} target="_blank" rel="noopener noreferrer">
                            <CreditCardIcon className="size-4" aria-hidden />
                            Buy credits on Totalum
                            <ExternalLinkIcon className="size-3.5 opacity-70" aria-hidden />
                        </a>
                    </Button>
                </>
            }
        >
            {/*
              ⭐ A NOTE FOR WHOEVER IS BUILDING WITH THIS APP, NOT FOR THEIR VISITORS.
              This modal talks about the operator's own Totalum balance, which is nobody
              else's business once the project is published — so it says, in the one place
              the reader is already looking, how to get rid of it.
            */}
            <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs leading-relaxed">
                Before you publish your project, tell the AI to remove this modal.
            </p>
        </Modal>
    );
}
