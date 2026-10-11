"use client";

import * as React from "react";
import { useT } from "@/i18n";
import { vcaasApi } from "@/lib/vcaas";

/**
 * ═══ SHIM — the platform's `usePrice`, read from the API ═════════════════════
 *
 * The copied More-view components show fixed prices ("Pause · 2 credits"). The platform reads them from its
 * credits context; here they come from `GET /credit-costs` (free), fetched once per engine and shared by every
 * caller. Until it answers, a price reads "…".
 */
type Engine = "v2" | "legacy";
type Costs = Record<string, number>;

const cache = new Map<Engine, Promise<Costs | null>>();

function loadCosts(engine: Engine): Promise<Costs | null> {
    let pending = cache.get(engine);
    if (!pending) {
        pending = vcaasApi.creditCosts(engine).then(r => (r.ok ? r.data?.creditCosts ?? null : null));
        cache.set(engine, pending);
    }
    return pending;
}

export function usePrice(): (key: string | string[], engine?: Engine) => string {
    const t = useT();
    const [costs, setCosts] = React.useState<Partial<Record<Engine, Costs | null>>>({});
    const wanted = React.useRef(new Set<Engine>());
    const price = React.useCallback(
        (key: string | string[], engine: Engine = "v2") => {
            const list = costs[engine];
            if (!list) {
                if (!wanted.current.has(engine)) {
                    wanted.current.add(engine);
                    void loadCosts(engine).then(c => setCosts(prev => ({ ...prev, [engine]: c })));
                }
                return "…";
            }
            const n = Math.round((Array.isArray(key) ? key : [key]).reduce((sum, k) => sum + (list[k] ?? 0), 0) * 100) / 100;
            return t(n === 1 ? "credits.price.one" : "credits.price.other", { credits: n });
        },
        [costs, t]
    );
    return price;
}
