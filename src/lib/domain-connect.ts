/**
 * The "Add custom domain" modal's pure rules (domodal): what a typed hostname becomes on the engine, and what a
 * refused purchase tells the user. Kept apart from the components so the tests can pin them.
 */

/** Accepts `example.com` and `app.example.com`; rejects schemes, paths and ports. */
export const HOSTNAME_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/** What the user typed → a bare lowercase hostname (`https://Shop.Example.com/x` → `shop.example.com`). */
export function normaliseHostname(raw: string): string {
    return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
}

/**
 * PGM's rule (`putDomain`): a hostname with fewer than three labels is a whole domain, and a connected whole domain is
 * served on `www.` (an apex can't hold the CNAME at most providers). The bare apex then needs a redirect to `www`
 * at the user's provider — the modal says so before they connect.
 */
export const isApexHostname = (hostname: string) => hostname.split(".").length < 3;

/** The hostname the project will answer on once `hostname` is connected. */
export const servedHostname = (hostname: string) => (isApexHostname(hostname) ? `www.${hostname}` : hostname);

/** The apex a `www.` hostname belongs to, or null — the domain that needs a redirect to `www`. */
export const apexOf = (hostname: string) =>
    hostname.startsWith("www.") && hostname.split(".").length === 3 ? hostname.slice(4) : null;

/** A refused `POST /domains/purchase` → the i18n key that tells the user what to do (`workspace.domain.buy.err*`). */
export function purchaseErrorKey(code: string | undefined): string | null {
    switch (code) {
        case "NO_PAYMENT_METHOD":
            return "workspace.domain.buy.errNoCard";
        case "PAYMENT_FAILED":
            return "workspace.domain.buy.errDeclined";
        case "PRICE_CHANGED":
            return "workspace.domain.buy.errPriceChanged";
        case "DOMAIN_UNAVAILABLE":
            return "workspace.domain.buy.errUnavailable";
        case "PLAN_REQUIRED":
            return "workspace.domain.buy.errPlan";
        case "DOMAIN_LIMIT_REACHED":
            return "workspace.domain.buy.errLimit";
        case "REGISTRATION_FAILED":
            return "workspace.domain.buy.errRefunded";
        default:
            return null;
    }
}

/** A purchase answered 201 with `warnings` → the note shown on the success screen (attach is best-effort). */
export function attachWarningKey(warnings: { code: string }[] | undefined): string | null {
    const code = warnings?.[0]?.code;
    if (code === "ATTACH_SKIPPED_INSUFFICIENT_CREDITS") return "workspace.domain.buy.warnCredits";
    if (code) return "workspace.domain.buy.warnAttach";
    return null;
}

/** A managed domain's pending help must not ask the user to add records Totalum writes itself. */
export const domainHelpKey = <K extends string>(helpKey: K, managed: boolean) =>
    managed && helpKey === "workspace.domain.helpPendingValidation" ? ("workspace.domain.helpPendingManaged" as const) : helpKey;

/** The hostname belongs to a domain bought through Totalum and attached to this project: Totalum writes its records. */
export const isManagedHostname = (
    hostname: string,
    projectId: string,
    domains: { domain: string; attachedProjectId?: string }[],
) => domains.some(d => d.attachedProjectId === projectId && (hostname === d.domain || hostname.endsWith(`.${d.domain}`)));
