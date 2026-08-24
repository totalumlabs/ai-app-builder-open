import { NextResponse } from "next/server";

export { isRoutableProjectSlug } from "@/lib/project-slug";

/**
 * ═══ THE SINGLE-KEY VERSION OF totalum-platform's ROUTE GUARDS ══════════════
 *
 * ⚠️⚠️ THIS FILE EXISTS SO THE COPIED ROUTES CAN STAY COPIES. `/api/preview/*` and
 * `/api/visual-edit/*` are lifted from the platform, where every request is a signed-in
 * user's and each one carries its own hidden VCaaS key — hence `resolveVcaasContext`
 * (who is asking?) and `enforceProjectScope` (may they touch THIS project?).
 *
 * This app has neither question to answer: it is a single-tenant open demo holding ONE
 * `TOTALUM_VCAAS_API_KEY` in its environment, and every project that key can reach is by
 * definition the operator's own. So both guards are honest no-ops here, and the copied
 * routes keep calling them unchanged.
 *
 * ⚠️⚠️ IF YOU EVER PUT REAL USERS BEHIND THIS APP, THIS IS THE FILE THAT MUST STOP BEING
 * A NO-OP. Deploy it as-is with a login in front and every user reaches every project the
 * key owns — the routes will not save you, because they delegate exactly this decision to
 * the two functions below.
 */

export interface VcaasContext {
    /** Present in the platform, unused here — the key is the whole identity. */
    accountUserId?: string;
}

export interface VcaasAuthOk {
    ok: true;
    ctx: VcaasContext;
    /**
     * The platform's actor/permission context. There is no actor here — one API key, one
     * operator — so it is an empty marker that `enforceProjectScope` ignores.
     */
    team: Record<string, never>;
}

export type VcaasAuthResult = VcaasAuthOk | { ok: false; response: NextResponse };

export type VcaasAuthFailed = Extract<VcaasAuthResult, { ok: false }>;

export function authFailed(result: VcaasAuthResult): result is VcaasAuthFailed {
    return result.ok === false;
}

/** Always succeeds: the server's own API key is the caller. */
export async function resolveVcaasContext(): Promise<VcaasAuthResult> {
    return { ok: true, ctx: {}, team: {} };
}

/**
 * Always allows: every project the key can reach belongs to whoever runs this app.
 * Same signature as the platform's — `(team, method, pathSegments)` — so the routes that
 * call it need no edit.
 */
export function enforceProjectScope(
    _team: Record<string, never>,
    _method: string,
    _path: string[],
): NextResponse | null {
    return null;
}
