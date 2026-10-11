/**
 * Stripe Connect payments of a v2 project (A6.11, plan 15 §4.11, plan 11 §9.4). SDK-API owns one
 * connected account per Stripe mode; the owner connects only the live one (Francesc 2026-10-07: the
 * preview's test account needs no onboarding). These helpers read its status, build the links and
 * decide what the Test/Live switch may do.
 */

export type PaymentsMode = "test" | "live";

/** `GET …/payments/status` as SDK-API answers it (contracts `PaymentsStatus`). */
export interface PaymentsStatus {
    enabled: boolean;
    mode: "connect" | "own_key";
    accountId: string | null;
    livemode: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    requirements: { currentlyDue: string[]; pastDue: string[]; eventuallyDue: string[] };
    /** The owner switched the published site to live payments (`PUT …/payments/mode`). */
    liveEnabled?: boolean;
    /** The merchant disconnected this mode's account from Totalum: its charges are refused until it is set up again. */
    disconnectedAt?: string | null;
}

/** `GET …/webhook` (plan 04 §5.13): Connect events reach this endpoint as `payments.<type>`. */
export interface ProjectWebhook {
    url: string | null;
    enabled: boolean;
    secretPrefix: string | null;
}

export type AccountState = "none" | "onboarding" | "restricted" | "active" | "disconnected";

/**
 * No account yet → none; can charge and pay out → active; submitted (or half-enabled) but Stripe still wants
 * something → restricted; otherwise onboarding. A fresh account already lists every requirement as `pastDue`
 * (dev, 2026-09-25), so past-due alone means "not submitted yet", not restricted.
 */
export function accountState(s: PaymentsStatus | null): AccountState {
    if (s?.disconnectedAt) return "disconnected";
    if (!s?.enabled) return "none";
    if (s.chargesEnabled && s.payoutsEnabled) return "active";
    if (s.detailsSubmitted || s.chargesEnabled) return "restricted";
    return "onboarding";
}

/** What the owner reads about the live account: `restricted` with nothing due is Stripe still checking the details. */
export type ConnectView = AccountState | "checking";
export function connectView(s: PaymentsStatus | null): ConnectView {
    const state = accountState(s);
    return state === "restricted" && !s?.requirements.currentlyDue.length ? "checking" : state;
}

/**
 * P2 (SDK-API `PAYMENTS_PUBLISH_FIRST`): the live Stripe account is connected only once the project was published, so
 * until then its connect/finish/reconnect action is off and the window offers Publish. Test onboarding (dev) never waits.
 */
export function publishFirst(mode: PaymentsMode, published: boolean, view: ConnectView): boolean {
    return mode === "live" && !published && view !== "active" && view !== "checking";
}

/**
 * Stripe's return and refresh URLs: HTTPS only (SDK-API refuses anything else), so a local
 * `http://localhost` platform falls back to the configured public app URL.
 */
export function onboardingUrls(origin: string, projectId: string, fallbackOrigin?: string) {
    const base = origin.startsWith("https://") ? origin : fallbackOrigin?.startsWith("https://") ? fallbackOrigin : null;
    if (!base) return null;
    const page = `${base.replace(/\/$/, "")}/project/${encodeURIComponent(projectId)}`;
    return { returnUrl: `${page}?payments=return`, refreshUrl: `${page}?payments=refresh` };
}

/** Why the Test/Live switch cannot be turned on; `null` = it can. */
export type LiveBlock = "notConfigured" | "notOnboarded" | "disconnected" | null;

/**
 * The published site's Test/Live switch (plan 11 §9.4): on = `liveEnabled`. Turning it on needs a live account that
 * can take charges (`chargesEnabled` + `detailsSubmitted`, SDK-API refuses otherwise); turning it off is always allowed.
 * `notConfigured` = this environment has no live Stripe key (dev): `…/status?mode=live` answers `PAYMENTS_NOT_ENABLED`.
 */
export function liveSwitch(live: PaymentsStatus | null, notConfigured: boolean): { on: boolean; canToggle: boolean; block: LiveBlock } {
    const on = live?.liveEnabled === true;
    const block: LiveBlock = notConfigured
        ? "notConfigured"
        : live?.disconnectedAt
          ? "disconnected"
          : live?.chargesEnabled && live.detailsSubmitted
            ? null
            : "notOnboarded";
    return { on, canToggle: on || block === null, block };
}

/** The countries Stripe onboards connected accounts in (Stripe's global availability list); the live account's country is final. */
export const STRIPE_COUNTRIES = [
    "AE", "AT", "AU", "BE", "BG", "BR", "CA", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GI", "GR", "HK",
    "HR", "HU", "IE", "IT", "JP", "LI", "LT", "LU", "LV", "MT", "MX", "MY", "NL", "NO", "NZ", "PL", "PT", "RO", "SE", "SG",
    "SI", "SK", "TH", "US",
] as const;

/** The first candidate Stripe onboards connected accounts in (account country, then location, then browser), else none. */
export function pickStripeCountry(...candidates: (string | null | undefined)[]): string {
    for (const c of candidates) {
        const code = c?.trim().toUpperCase();
        if (code && (STRIPE_COUNTRIES as readonly string[]).includes(code)) return code;
    }
    return "";
}

/** The browser's own region when Stripe supports it (a good first guess for the merchant), else none. */
export function guessCountry(locale: string | undefined): string {
    const region = locale?.split(/[-_]/)[1]?.toUpperCase();
    return region && (STRIPE_COUNTRIES as readonly string[]).includes(region) ? region : "";
}
