"use client";

/**
 * ═══ SHIM — see `PaidFeature.tsx` ═════════════════════════════════════════════
 *
 * The platform refreshes its per-plan capability counters after a domain or a GitHub
 * repository is attached. There are no counters here, so `refresh` is a no-op that
 * keeps the copied modals compiling.
 */
export function useCapabilities(): { refresh: () => Promise<void> } {
    return { refresh: async () => {} };
}
